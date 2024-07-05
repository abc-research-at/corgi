/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains parts of the solidity compiler backend.
 * It contains aspects of the code-generation that applies to
 * both, dynamic and standard orgcharts
 */
import {
  ConstructorlessContractContext,
  ContractContext,
  ContractGenerator,
  MethodContext,
  Parameter,
} from "../tools/ContractGenerator";
import {
  CompilerConfig,
  InitAssignment,
  OrgChartDef,
  RuleDef,
} from "@core/common";
import { FileWriter } from "@core/fs";
import { OrgChartAnalysis } from "@core/analysis";
import path from "path";
import { Hash } from "@utils";

/**
 * Abstract compiler backend for solidity smart contract.
 * This class wraps some commonly used code-snippet-generating-
 * function. Compiler backends for a specific orgchart type should
 * inherit from this class
 */
export abstract class AbstractOrgChartCompiler {
  protected static readonly UINT_256_MAX =
    (BigInt(1) << BigInt(256)) - BigInt(1);

  protected generator: ContractGenerator;

  protected readonly analysis: OrgChartAnalysis;

  private static readonly RULE_HASH =
    "0x64bddff132fc1c7cb4776ef381143d78d0f2f6873b824fa04d6c83665ba25c38";

  /**
   * Constructor
   *
   * @param orgChartDef definition of the orgchart
   * @param config different options for the compiler
   * @param writer an instance of `FileWriter` specifying the
   *               output location
   */
  public constructor(
    protected readonly orgChartDef: OrgChartDef,
    protected readonly config: CompilerConfig,
    writer: FileWriter
  ) {
    this.analysis = new OrgChartAnalysis(orgChartDef);
    this.generator = new ContractGenerator(writer);
  }

  /**
   * Compile the orgchart passed by the constructor
   *
   * @returns a `Promise` resolving after all the content is written to
   *          the output file
   */
  public compile(): Promise<void> {
    this.generateHeader();
    this.generator.appendLine("\n");
    this.generateContract();
    return this.generator.close();
  }

  /**
   * Internal function for generating the file header. The header
   * contains basic copyright declaration as well as the needed imports
   */
  private generateHeader(): void {
    const year = new Date().getFullYear();
    this.generator
      .comment(this.config.license)
      .comment(`Copyright (c) ${year} ${this.config.copyRight}`)
      .comment("This contract was automatically created by CORGI")
      .appendLine(`\npragma solidity ${this.config.solidityVersion};`)
      .appendLine(
        `\nimport "${path.join(
          this.config.libDir,
          this.baseClass() + ".sol"
        )}";`
      );
  }

  /**
   * Abstract method for specifying the base class of the
   * contract.
   *
   * @returns the name of the base class
   *
   * @remark it is assumed that the file containing the base class
   *         has the same name as the base class itself.
   *         The location of the base class' file can be specified
   *         using the property `libDir` of the `GeneratorConfig` which
   *         is passed to the generator's constructor.
   */
  protected abstract baseClass(): string;

  /**
   * Internal function for generating the actual contract code
   */
  private generateContract(): void {
    const contract = this.generator
      .contract(this.orgChartDef.contractName)
      .isA(this.baseClass());
    this.generateConstants(contract);
    this.generateConstructor(contract).end();
  }

  /**
   * Introduces constants for role ids
   *
   * @param contract contract's writer-context
   * @returns the very same context
   */
  private generateConstants(
    contract: ConstructorlessContractContext
  ): ConstructorlessContractContext {
    this.orgChartDef.roles.forEach((role) => {
      const constName = role
        .replace(" ", "_")
        .replace(/([A-Z]+)([^A-Z]|$)/g, "_$1$2")
        .replace(/^_(.*)$/g, "$1")
        .toUpperCase();
      const id = this.analysis.role2Id.assertExist(role);

      contract.appendLine(`bytes32 public constant ${constName} = ${id};`);
    });
    contract.appendLine();
    return contract;
  }

  /**
   * Internal function for generating the contract's constructor
   *
   * @param contract contract's writer-context
   * @returns the contract's writer-context
   */
  private generateConstructor(
    contract: ConstructorlessContractContext
  ): ContractContext {
    const pars = this.orgChartDef.initialization
      .filter((d) => d.type === "parameter")
      .map((p) => [p.value, "address"] as Parameter);
    const construct = contract.construct(pars, `${this.baseClass()}()`);
    this.constr(construct);

    const init = AbstractOrgChartCompiler.computeInitialRoleCount(
      this.orgChartDef.initialization
    );
    init.forEach((num, role) => {
      construct.appendLine(
        `roleIdToNOAssignments[${this.analysis.role2Id.assertExist(
          role
        )}] = ${num};`
      );
    });

    this.generateRules(construct);
    return construct.return();
  }

  /**
   * Computes the initial number of assigned users per role
   *
   * @param init set of initial role assignments
   * @returns map, mapping from role-name to number of assigned users
   */
  private static computeInitialRoleCount(
    init: InitAssignment[]
  ): Map<string, number> {
    const role2Num = new Map<string, number>();

    init.forEach((i) => {
      const num = role2Num.get(i.role);
      if (num) {
        role2Num.set(i.role, num + 1);
      } else {
        role2Num.set(i.role, 1);
      }
    });
    return role2Num;
  }

  /**
   * Abstract function for specifying the constructor's content. This
   * function will be overwritten by the specific orgchart generator for
   * each type and can be used to add additional configuration needed for
   * the orgchart.
   *
   * @param constructor writer-context of the constructor
   *
   * @remark The constructor context MUST NOT BE CLOSED
   */
  protected abstract constr(constructor: MethodContext): void;

  /**
   * Internal function for generating the initializations for the grant- and
   * revoke-rules
   *
   * @param method writer-context of the initialization-method
   *
   * @remark This function does not change
   *         the context, hence no context is returned.
   */
  private generateRules(method: MethodContext) {
    method.appendLine();
    const ruleHash2Mask: Map<string, [RuleDef, bigint]> = new Map();

    this.orgChartDef.roleDef.forEach((def) => {
      AbstractOrgChartCompiler.checkIfRulesAreSafe(def.role, def.grantRules);
      AbstractOrgChartCompiler.checkIfRulesAreSafe(def.role, def.revokeRules);

      const op = (rule: RuleDef) => {
        const hash = this.computeRuleHash(rule);
        const roleFlag = this.analysis.role2Flag.assertExist(def.role);
        if (!ruleHash2Mask.has(hash)) {
          ruleHash2Mask.set(hash, [rule, roleFlag]);
        } else {
          const mask = (ruleHash2Mask.get(hash)![1] as bigint) | roleFlag;
          ruleHash2Mask.set(hash, [rule, mask]);
        }
      };

      def.grantRules.forEach((rule) => op(rule));
      def.revokeRules.forEach((rule) => op(rule));
    });

    ruleHash2Mask.forEach(([rule, mask], hash) =>
      method
        .append(`ruleHashToRoleFlags[${hash}] = 0x${mask.toString(16)};`)
        .comment(RuleDef.toCommentString(rule))
    );

    this.addFurtherRules(method);
  }

  protected addFurtherRules(_method: MethodContext) {}

  /**
   * Internal helper function for computing the hash of
   * a grant- or revoke-rule
   *
   * @param ruleDef rule
   * @returns hash of the rule represented as an hex string
   */
  protected computeRuleHash(ruleDef: RuleDef): string {
    const hash = Hash.init();
    const encoding = hash.subEncoding();
    const atoms = this.getNormEncodedRuleBody(ruleDef);

    encoding.addBytes32(AbstractOrgChartCompiler.RULE_HASH);
    encoding.subHash().addString(ruleDef.type.toLowerCase());
    encoding.addBoolean(ruleDef.selfSignRequired);
    encoding.subHash().subEncoding().addBytes32Array(atoms);

    return hash.encode();
  }

  /**
   * Encodes the body of the rule such that each atom
   * of the rule can be represented by an 32-byte sized
   * word
   *
   * @param ruleDef rule to encode
   * @returns encoding of each atom in the rule body
   */
  private getNormEncodedRuleBody(ruleDef: RuleDef): string[] {
    return ruleDef.required
      .map((atom) => this.analysis.encodeRuleAtom(atom))
      .sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
  }

  /**
   * Internal function for checking if a rule is safe. Applies some checks and
   * warns the user if violated.
   *
   * @param head head of the rule
   * @param rules set of rules to check
   */
  private static checkIfRulesAreSafe(head: string, rules: RuleDef[]) {
    rules.forEach((rule, i) => {
      if (rule.required.some((atom) => atom.isRelative && !atom.isStrict)) {
        console.warn(`Warning in ${rule.type}-rule #${i + 1} of ${head}:`);
        console.warn("Rule is using relative numbers but is not strict");
        console.warn(
          "Be aware that for the number of users of a role only direct assignments are counted"
        );
      }
      if (rule.selfSignRequired && !rule.selfSignable) {
        console.warn(`Warning in ${rule.type}-rule #${i + 1} of ${head}:`);
        console.warn(
          "Rule is using a self-sign-required but rule is not selfsignable"
        );
        console.warn(
          "Requirement of self-sign is ignored (only allowed for grant rules)"
        );
      }
    });
  }
}
