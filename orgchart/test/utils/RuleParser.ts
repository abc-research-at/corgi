/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains a small rule-parser that eases the definition
 * of grant/revoke-rules. Only meant to be used for testing purposes.
 */

import { computeRoleId, toPrefixed256BitHexString } from "./common";

/**
 * Rule parser that converts a string-representation of the rule to
 * a usable representation for the org chart. The syntax of the rule looks
 * as follows:
 *
 *
 *       ┌──────────────────────────────┐
 * ┌─────┴────┐    ┌──────────┐      ┌──▼───┐       ┌────────┐
 * │ Q-Role 1 ├─┬──► Q-Role i ├─┬────► "->" ├───────► <role> ├───►◉
 * └──────────┘ │  └──────────┘ │    └──┬───┘       └───▲────┘
 *              │               │       │               │
 *              │               │       │               │
 *              │    ┌─────┐    │       │    ┌─────┐    │
 *              └────┤ "," ◄────┘       └────► "-" ├────┘
 *                   └─────┘                 └─────┘
 *
 * where `Q-Role` is a placeholder for the syntax diagram:
 *
 *      ┌─────────────────────────────────────────┐
 * ┌────┴───┐   ┌─────┐   ┌───────┐   ┌─────┐     ▼
 * │ <rol>  ├───► "(" ├───► <num> ├───► ")" ├────►◉
 * └────────┘   └─────┘   └───────┘   └─────┘
 *
 * A self sign can be represented by using the role-name "self" (in this case, the
 * quantity is ignored).
 */
export class RuleParser {
  public static readonly FLAG_STRICT_ROLE = 0x1;
  public static readonly FLAG_RELATIVE_QTY = 0x2;

  /**
   * Parses a rule string to a set of atoms (bit-vector of size 256 bit) (= hex-string encoding of rule-elements,
   * i.e. quantified roles).
   *
   * @param rule string encoding of the rule (see comment at the top of the class)
   * @returns boolean-string[] tuple, where the first element indicates if the rule
   *          requires a self-sign and the second element is an hex-string-encoding of
   *          the required rules.
   */
  public static parseTo256BitVector(rule: string): [boolean, string[]] {
    const [selfSignReq, atoms] = this.parse(rule);

    return [
      selfSignReq,
      atoms.map((a) => this.encode(a)).map((a) => toPrefixed256BitHexString(a)),
    ];
  }

  /**
   * Parse a rule and convert to the internal representation
   *
   * @param rule string encoding of the rule (see comment at the top of the class)
   * @returns boolean-string[] tuple, where the first element indicates if the rule
   *          requires a self-sign and the second element is an array of atoms.
   */
  public static parse(rule: string): [boolean, Atom[]] {
    const strAtoms = rule
      .split(",")
      .map((a) => a.trim())
      .map((a) => this.toAtom(a));
    const selfSignReq = strAtoms.findIndex(({ role }) => role == "self") >= 0;

    return [selfSignReq, strAtoms.filter(({ role }) => role != "self")];
  }

  /**
   * Internal function for converting a string-encoded atom (quantified role) to
   * its internal representation.
   *
   * @param strAtom string encoding
   * @returns atom
   */
  private static toAtom(strAtom: string): Atom {
    let qty = 1;
    let role = strAtom;
    let isRelative = false;
    let isStrict = false;

    if (role.startsWith("!")) {
      isStrict = true;
      role = strAtom.slice(1);
    }

    let match: RegExpMatchArray;
    if ((match = role.match(/^([a-zA-Z][a-zA-Z0-9]*)\(([0-9]+)\)$/)) != null) {
      role = match[1];
      qty = Number(match[2]);
    } else if (
      (match = role.match(/^([a-zA-Z][a-zA-Z0-9]*)\(([0-9]+)%\)$/)) != null
    ) {
      role = match[1];
      qty = Number(match[2]);
      isRelative = true;
    }

    return {
      role,
      isStrict,
      isRelative,
      qty,
    };
  }

  /**
   * Internal function for encoding the internal presentation of an atom
   * to an bit-vector of size 256 encoding that can be used for the orgchart.
   *
   * @param atom atom to encode
   * @returns bit-vector of size 256 represented as bigint
   */
  private static encode(atom: Atom): bigint {
    const flags = BigInt(
      (atom.isRelative ? RuleParser.FLAG_RELATIVE_QTY : 0) |
        (atom.isStrict ? RuleParser.FLAG_STRICT_ROLE : 0)
    );

    const roleId = BigInt(computeRoleId(atom.role));
    const qty = BigInt(atom.qty);

    if (qty > 255) {
      throw new Error(
        `Error: Cannot encode atom ${atom.role}: Quantity needs to fit in one byte`
      );
    }
    return roleId | (qty << BigInt(240)) | (flags << BigInt(248));
  }
}

/**
 * Internal representation of an atom of a rule.
 */
export interface Atom {
  role: string;
  isStrict: boolean;
  isRelative: boolean;
  qty: number;
}
