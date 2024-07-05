/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the solidity compiler backend for dynamic orgcharts,
 * where dynamic means that new roles can be added to and existing roles can
 * be deleted from the orgchart after deployment.
 */

import { RuleDef } from "../../common";
import { MethodContext } from "../tools/ContractGenerator";
import { AbstractOrgChartCompiler } from "./AbstractOrgChartCompiler";

/**
 * Class implementing the solidity compiler backend for dynamic org charts.
 * This class inherits from the more general orgchart compiler
 * and hence only implements those parts that are specific to dynamic
 * orgcharts
 */
export class DynOrgChartCompiler extends AbstractOrgChartCompiler {
  private readonly flag = (role: string) =>
    `0x${this.analysis.role2Flag.assertExist(role).toString(16)}`;
  private readonly id = (role: string) =>
    this.analysis.role2Id.get(role).assertPresent();

  /**
   * Getter for the base class
   *
   * @returns the name of base class
   */
  protected baseClass = () => "DynamicBitVectorOrgChart";

  /**
   * Generator for the constructor. This function will be
   * called by the abstract super-class `OrgChartContract`.
   *
   * @param constructor writer-context of the constructor
   * @returns the writer-context of the constructor's contract
   */
  protected constr(constructor: MethodContext) {
    this.createOrgChartData(constructor);
    this.createInitialAssignments(constructor);
  }

  /**
   * Create all necessary initializations to represent the orgchart
   * structure
   *
   * @param constructor current writer context (for the constructor)
   * @returns constructor's writer context
   */
  private createOrgChartData(constructor: MethodContext): MethodContext {
    this.orgChartDef.roles.forEach((role) =>
      constructor.appendLine(
        `roleId2Flag[${this.id(role)}] = ${this.flag(role)}; // ${role}`
      )
    );
    this.analysis.topologicalRoleOrder
      .reverse()
      .forEach((role, idx) =>
        constructor.appendLine(
          `roleIdx2Flag[${idx}] = ${this.flag(role)}; // ${role}`
        )
      );

    this.analysis.role2Mask.forEach((mask, role) =>
      constructor.appendLine(
        `roleFlag2Mask[${this.flag(role)}] = 0x${mask.toString(16)}; // ${role}`
      )
    );
    this.analysis.role2JuniorMask.forEach((mask, role) =>
      constructor.appendLine(
        `roleFlag2JuniorMask[${this.flag(role)}] = 0x${mask.toString(
          16
        )}; // ${role}`
      )
    );

    constructor.appendLine(
      `freeRoleFlags = 0x${this.analysis.freeRoleFlags.toString(16)};`
    );
    constructor.appendLine(
      `activeRoleFlags = 0x${(
        AbstractOrgChartCompiler.UINT_256_MAX & ~this.analysis.freeRoleFlags
      ).toString(16)};`
    );
    constructor.appendLine(
      `numOfActiveRoles = ${this.analysis.topologicalRoleOrder.length};`
    );

    return constructor;
  }

  /**
   * Create initial user-role-assignments according to the the orglang file.
   *
   * @param constructor writer context of the constructor
   * @returns writer context of the constructor
   */
  private createInitialAssignments(constructor: MethodContext): MethodContext {
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
      constructor.appendLine(`user2Roles[${user}] = 0x${mask.toString()};`);

      if (i != user2roles.size - 1) {
        constructor.appendLine();
      }
      i++;
    });

    return constructor;
  }

  protected override addFurtherRules(context: MethodContext) {
    this.orgChartDef.adminRules.forEach((rule) => {
      const hash = this.computeRuleHash(rule);

      context
        .append(`ruleHashToRoleFlags[${hash}] = type(uint256).max;`)
        .comment(RuleDef.toCommentString(rule));
    });
  }
}
