/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the schema of the orgchart definition.
 */

/**
 * Interface describing the schema of
 * the initial role assignment definition.
 */
export interface InitAssignment {
  role: string;
  type: "address" | "parameter";
  value: string;
}

/**
 * Schema describing the definition of a rule
 */
export interface RuleDef {
  required: RuleDefAtom[];
  type: "revoke" | "grant" | "admin";
  selfSignable: boolean;
  selfSignRequired: boolean;
}

export namespace RuleDef {
  /**
   * Returns a representation of a rule
   * that can be used in comments of the solidity code
   *
   * @param def definition of the rule
   * @returns string representation
   */
  export function toCommentString(def: RuleDef): string {
    const body = def.required
      .map((atom) => RuleDefAtom.toCommentString(atom))
      .join(", ");

    switch (def.type) {
      case "grant":
        if (def.selfSignRequired) return `Grant Rule: ${body}, self`;
        return `Grant Rule: ${body}`;
      case "revoke":
        return `Revoke Rule: ${body}`;
      case "admin":
        return `Admin Rule: ${body}`;
    }
  }
}

/**
 * Schema describing one atom (that is, a role with its
 * required quantity and level of strictness) of
 * a grant- or revoke-rule.
 */
export interface RuleDefAtom {
  role: string;
  isStrict: boolean;
  isRelative: boolean;
  n: number;
}

export namespace RuleDefAtom {
  /**
   * returns a representation of an atom
   * that can be used in comments of the solidity code
   *
   * @param atom
   * @returns string representation
   */
  export function toCommentString(atom: RuleDefAtom): string {
    const quantity = atom.isRelative ? `${atom.n}%` : atom.n;
    const role = atom.isStrict ? `!${atom.role}` : atom.role;

    return `${role}(${quantity})`;
  }
}

/**
 * Interface describing the schema of
 * the role definition.
 */
export interface RoleDef {
  role: string;
  seniors: string[];
  grantRules: RuleDef[];
  revokeRules: RuleDef[];
}

/**
 * Interface describing the schema of the
 * orgchart definition.
 */
export interface OrgChartDef {
  contractName: string;
  orgChartType: "std" | "dyn";
  roles: string[];
  initialization: InitAssignment[];
  roleDef: RoleDef[];
  adminRules: RuleDef[];
}
