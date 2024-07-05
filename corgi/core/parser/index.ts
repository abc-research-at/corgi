/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the parser for the orglang used
 * for defining org-charts.
 */

import {
  InitAssignment,
  OrgChartDef,
  RoleDef,
  RuleDef,
  RuleDefAtom,
} from "@core/common";
import { OrgFile, Rule, SyntaxError, parse } from "./peggy";
import { SafeMap } from "@utils";
import { basename } from "path";
import assert from "assert";

type ParsingErrorLocation = { line: number; col: number };

/**
 * Error class used for representing parsing-errors.
 */
export class ParsingError extends Error {
  /**
   * Constructor
   *
   * @param location location of the parsing error
   * @param reason description of the parsing error
   * @param fileName name of the org-file where the error occurred
   */
  private constructor(
    public location: ParsingErrorLocation,
    public reason: string,
    public fileName: string
  ) {
    const strLoc = `${location.line}:${location.col}`;
    super(`Error in ${fileName} at ${strLoc}: ${reason}`);
  }

  /**
   * Converts peggy's SyntaxError to a ParsingError to avoid
   * propagate package-dependencies to higher levels of the orgchart-generator.
   *
   * @param err instance of peggy's `SyntaxError`
   * @param fileName name of the file where the error happened
   * @returns instance of `ParsingError` with the according values copied over
   *          from peggy's `SyntaxError`
   */
  public static fromPeggyError(err: SyntaxError, fileName: string) {
    return new ParsingError(
      {
        line: err.location.start.line,
        col: err.location.start.column,
      },
      err.message,
      fileName
    );
  }

  /**
   * Overwritten `toString` function
   *
   * @returns log-able error
   */
  public toString(): string {
    return this.message;
  }
}

/**
 * Parser for orglang. For the actual parsing-part
 * the parser-generator peggy is used.
 */
export class Parser {
  /**
   * Constructor
   *
   * @param src orglang string defining an orgchart
   * @param fileName file name needed for logging purposes
   */
  public constructor(
    private readonly src: string,
    private readonly fileName = "[Unknown Input File]"
  ) {}

  /**
   * Passed the source passed in the constructor. In case of an
   * syntax error, an error will be thrown.
   *
   * @returns parsed orgchart definition
   */
  public parse(): OrgChartDef {
    try {
      return this.convert(parse(this.src));
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw ParsingError.fromPeggyError(err, basename(this.fileName));
      }
      throw err;
    }
  }

  /**
   * Internal function for parsing the org-file to a more usable
   * representation, namely to an instance of `OrgChartDef`.
   *
   * @param source raw (but already parsed) content of the org-file
   * @returns processed orgchart definition.
   */
  private convert(source: OrgFile): OrgChartDef {
    const roles = this.validateRoles(source);
    const [grant, revoke, admin] = this.validateRules(source, roles);
    const initAssignment = this.validateInitialAssignment(source, roles);

    roles.forEach((roleDef, role) => {
      if (grant.has(role)) roleDef.grantRules = grant.get(role).valOrElse([]);
      if (revoke.has(role))
        roleDef.revokeRules = revoke.get(role).valOrElse([]);
    });

    return {
      contractName: source.header.contractName,
      orgChartType: source.header.orgChartType,
      roles: Array.from(roles.keys()),
      roleDef: Array.from(roles.values()),
      adminRules: admin,
      initialization: initAssignment,
    };
  }

  /**
   * Internal function for validating the defined roles
   * int the org-file. In particular, the file is checked against
   * duplicates and undefined roles used in senior-role-definitions.
   *
   * @param file raw (but already passed) org-file
   * @returns a map, mapping from the role name to the corresponding processed
   *          role definition.
   */
  private validateRoles(file: OrgFile): SafeMap<string, RoleDef> {
    const roles = new Set<string>();

    file.body.roles.forEach((entry) => {
      if (roles.has(entry.role)) {
        throw new Error(
          `Parsing Error: Duplicate Definition for node "${entry.role}"`
        );
      }
      roles.add(entry.role);
    });

    const result = new SafeMap<string, RoleDef>();
    file.body.roles.forEach((entry) => {
      const valid = entry.seniors.every((senior) => roles.has(senior));
      if (!valid) {
        throw new Error(
          `Parsing Error: Unknown senior role in definition of role "${entry.role}"`
        );
      }
      result.set(entry.role, {
        role: entry.role,
        seniors: entry.seniors,
        grantRules: [],
        revokeRules: [],
      });
    });
    return result;
  }

  /**
   * Validates the grant- and revoke rules of the org-file. In particular,
   * this function validates that for each role at most one grant-rule and
   * one revoke-rule exists as disjunctive rules are not supported yet. Furthermore,
   * this function checks whether all roles referred to by the rules are defined.
   *
   * @param file raw (but already parsed) org-file
   * @param roles map mapping from role-names to their definition
   * @returns a tuple of maps, where the first maps from the role name to the grant rule
   *          and the second maps form the role name to the revoke rule
   */
  private validateRules(
    file: OrgFile,
    roles: SafeMap<string, RoleDef>
  ): [SafeMap<string, RuleDef[]>, SafeMap<string, RuleDef[]>, RuleDef[]] {
    const grantRulesPerNode = new SafeMap<string, RuleDef[]>();
    const revokeRulesPerNode = new SafeMap<string, RuleDef[]>();
    const adminRules = [] as RuleDef[];

    file.body.rules.forEach((entry) => {
      const rule = this.toRuleDef(entry, roles);
      switch (rule.type) {
        case "grant":
          assert(entry.head != null);
          assert(rule.selfSignable);
          if (!grantRulesPerNode.has(entry.head.role)) {
            grantRulesPerNode.set(entry.head.role, [rule]);
          } else {
            grantRulesPerNode.assertExist(entry.head.role).push(rule);
          }
          break;
        case "revoke":
          assert(entry.head != null);
          assert(!rule.selfSignable);
          if (!revokeRulesPerNode.has(entry.head.role)) {
            revokeRulesPerNode.set(entry.head.role, [rule]);
          } else {
            revokeRulesPerNode.assertExist(entry.head.role).push(rule);
          }
          break;
        case "admin":
          assert(entry.head == null);
          assert(!rule.selfSignable);
          adminRules.push(rule);
          break;
      }
    });
    return [grantRulesPerNode, revokeRulesPerNode, adminRules];
  }

  /**
   * Internal function converting the raw rules (generated by the parser) to
   * more usable `RuleDef` instances. Furthermore, this function makes sure that
   * each role referred to by the rules is also defined.
   *
   * @param rule rule to convert
   * @param roles map containing all the roles defined
   * @returns a tuple, where the first entry indicates if it is a grant or revoke rule and
   *          the second entry is the rule-definition.
   */
  private toRuleDef(rule: Rule, roles: SafeMap<string, RoleDef>): RuleDef {
    const [selfSignRequired, body] = this.parseRuleBody(rule, roles);

    if (rule.type === "user-management") {
      assert(rule.head != null);
      if (!roles.has(rule.head.role)) {
        throw new Error(
          `Parsing Error: Unknown role in rule's head: ${rule.head.role}`
        );
      }

      return {
        type: rule.head.sign ? "revoke" : "grant",
        selfSignable: !rule.head.sign, // only grants are self-signable
        selfSignRequired: !rule.head.sign && selfSignRequired, // only if grant, we consider this flag
        required: body,
      };
    }

    return {
      type: "admin",
      selfSignable: false,
      selfSignRequired: false,
      required: body,
    };
  }

  private parseRuleBody(
    rule: Rule,
    roles: SafeMap<string, RoleDef>
  ): [boolean, RuleDefAtom[]] {
    const body: RuleDefAtom[] = [];
    let selfSignRequired = false;
    const ruleRef = Parser.getRuleRefForErrorLog(rule);

    rule.body.forEach((e) => {
      const roleRef = `${e.role}(${e.isStrict ? "!" : ""}${e.n}${
        e.isRelative ? "%" : ""
      })`;
      if (e.isSelf) {
        selfSignRequired = true;
      } else {
        if (!roles.has(e.role)) {
          throw new Error(
            `Parsing Error: Unknown role in rule in ${ruleRef}: ${roleRef}`
          );
        }
        if (e.n > 255 || e.n <= 0) {
          throw new Error(
            `Parsing Error: Invalid quantity in ${ruleRef}: ${roleRef} (0 < qty < 256)`
          );
        }
        if (e.isRelative) {
          if (e.n > 100) {
            throw new Error(
              `Parsing Error: Invalid relative quantity in ${ruleRef}: ${roleRef}`
            );
          }
        }
        body.push(e);
      }
    });

    return [selfSignRequired, body];
  }

  private static getRuleRefForErrorLog(rule: Rule): string {
    if (rule.type === "admin") {
      return "admin-rule";
    }
    assert(rule.head != null);
    const role = rule.head.role;
    if (rule.head.sign) return `revoke-rule for ${role}`;
    return `grant-rule for ${role}`;
  }

  /**
   * Validates the initial assignments specified by the org-file.
   * In particular, it is validated if the addresses are valid Ethereum addresses
   * and that all roles assigned are defined.
   *
   * @param file raw (but already parsed) org-file
   * @param roles map containing all the roles defined in the org-file
   * @returns array of initial assignments
   */
  private validateInitialAssignment(
    file: OrgFile,
    roles: SafeMap<string, RoleDef>
  ): InitAssignment[] {
    return file.body.init.map((init) => {
      if (init.nomineeType === "address") {
        if (init.nominee.length != 42) {
          throw new Error(
            `Parsing Error: Address "${init.nominee}" invalid! Has to be a 20 bytes hex string with preceding "0x"`
          );
        }
        if (!roles.has(init.role)) {
          throw new Error(
            `Parsing Error: Unknown role "${init.role}" in default settings.`
          );
        }
      }
      return {
        role: init.role,
        value: init.nominee,
        type: init.nomineeType,
      };
    });
  }
}
