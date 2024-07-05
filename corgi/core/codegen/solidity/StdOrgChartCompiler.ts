/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the solidity compiler backend for standard orgcharts.
 */

import { MethodContext } from "../tools/ContractGenerator";
import { AbstractOrgChartCompiler } from "./AbstractOrgChartCompiler";

/**
 * Class implementing the solidity compiler backend for standard orgcharts.
 * This class inherits from the more general orgchart compiler
 * and hence only implements those parts that are specific to standard
 * orgcharts
 */
export class StdOrgChartCompiler extends AbstractOrgChartCompiler {
  private readonly flag = (role: string) =>
    `0x${this.analysis.role2Flag.assertExist(role).toString(16)}`;

  private readonly id = (role: string) =>
    this.analysis.role2Id.get(role).assertPresent();

  /**
   * Getter for the contract's base class
   *
   * @returns the name of the base class
   */
  protected baseClass = () => "BitVectorOrgChart";

  /**
   * Generator for the contract's constructor. This function
   * will be called by the abstract super-class `OrgChartContract`.
   *
   * @param constructor writer-context of the constructor
   * @returns writer-context of the constructor's contract
   */
  protected constr(constructor: MethodContext) {
    const user2roles: Map<string, string[]> = new Map();

    this.orgChartDef.initialization.forEach((def) => {
      let roles = user2roles.get(def.value);
      if (!roles) {
        roles = [];
        user2roles.set(def.value, roles);
      }
      roles.push(def.role);
    });

    let i = 0;
    user2roles.forEach((roles, user) => {
      const mask = roles
        .map((r) => this.analysis.role2Flag.assertExist(r))
        .reduce((a, b) => a | b, BigInt(0));
      constructor.comment(`Granting roles ${roles.join(",")} to ${user}`);
      constructor.appendLine(`user2Roles[${user}] = 0x${mask.toString(16)};`);
      if (i != user2roles.size - 1) {
        constructor.appendLine();
      }
      i++;
    });

    this.orgChartDef.roles.forEach((role) =>
      constructor.appendLine(
        `roleId2Flag[${this.id(role)}] = ${this.flag(role)}; // ${role}`
      )
    );
    this.analysis.role2Mask.forEach((mask, role) =>
      constructor.appendLine(
        `roleFlag2Mask[${this.flag(role)}] = 0x${mask.toString(16)}; // ${role}`
      )
    );

    constructor.appendLine(
      `activeRoleFlags = 0x${(
        AbstractOrgChartCompiler.UINT_256_MAX & ~this.analysis.freeRoleFlags
      ).toString(16)};`
    );
  }
}
