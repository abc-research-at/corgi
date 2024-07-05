import { DynamicBitVectorOrgChart } from "../../../typechain-types";
import { computeRuleHash } from "../common";
import { AdminRequest } from "./Request";
import { TestBuildingStep } from "./TestBuildingStep";
import { DynBVOrgChartTestContext } from "./TestContext";
import { Testbench } from "./Testbench";
import { AbstractFinalizationStep } from "./finalization";
import { SignatureBuilderInitStep } from "./signature";

/**
 * Initial building-step for testing an adding-role-request
 */
export class AddRoleTestInitStep extends SignatureBuilderInitStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest,
  SeniorFlagsSettingStep
> {
  public constructor(ctx: DynBVOrgChartTestContext, role: string) {
    super(
      ctx,
      new AdminRequest(role, "add"),
      (ctx, request) => new SeniorFlagsSettingStep(ctx, request)
    );
  }
}

class SeniorFlagsSettingStep extends TestBuildingStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Sets the senior roles of the new role
   *
   * @param seniors array of role names that are senior to the new role
   * @returns next building step
   */
  public withSeniors(seniors: string[]): JuniorFlagsSettingStep {
    this.request.addPromise(
      Promise.all(seniors.map((role) => this.ctx.getRoleFlag(role)))
        .then((flags) => flags.reduce((a, b) => a | b, BigInt(0)))
        .then((seniors) => (this.request.seniorFlags = seniors))
    );
    return new JuniorFlagsSettingStep(this.ctx, this.request);
  }

  /**
   * Sets the senior roles by directly defining the senior-role-mask
   *
   * @param seniorFlags bit-mask having the role-flag of every senior role set to 1
   * @returns next building step
   */
  public withSeniorFlags(seniorFlags: bigint): JuniorFlagsSettingStep {
    this.request.seniorFlags = seniorFlags;
    return new JuniorFlagsSettingStep(this.ctx, this.request);
  }
}

/**
 * Building-step for setting the junior flags
 */
class JuniorFlagsSettingStep extends TestBuildingStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Sets the junior roles of the new role
   * @param juniors array of role-names that should be junior to the new role
   * @returns next building-step
   */
  public withJuniors(juniors: string[]): GrantRuleSettingStep {
    this.request.addPromise(
      Promise.all(juniors.map((role) => this.ctx.getRoleFlag(role)))
        .then((flags) => flags.reduce((a, b) => a | b, BigInt(0)))
        .then((juniors) => (this.request.juniorFlags = juniors))
    );
    return new GrantRuleSettingStep(this.ctx, this.request);
  }

  /**
   * Sets the junior roles by directly setting the junior-role-mask
   *
   * @param juniorFlags bit-mask where the role-flag of every junior role is set
   * @returns next building-step
   */
  public withJuniorFlags(juniorFlags: bigint): GrantRuleSettingStep {
    this.request.juniorFlags = juniorFlags;
    return new GrantRuleSettingStep(this.ctx, this.request);
  }
}

/**
 * Building-step for setting the grant rule
 */
class GrantRuleSettingStep extends TestBuildingStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Omits the grant rule; this role cannot be granted to anyone
   *
   * @returns next building step
   */
  public omitGrantRules(): RevokeRuleSettingStep {
    this.request.ruleHashes = [];
    return new RevokeRuleSettingStep(this.ctx, this.request);
  }

  /**
   * Sets one or multiple grant rules for the role
   *
   * @param rules array of grant rules specified in org-lang
   * @returns next building-step
   */
  public setGrantRules(rules: string[]): RevokeRuleSettingStep {
    this.request.ruleHashes = rules.map((rule) =>
      computeRuleHash(rule, "grant")
    );
    return new RevokeRuleSettingStep(this.ctx, this.request);
  }
}

/**
 * Building-step for setting the revoke rule
 */
class RevokeRuleSettingStep extends TestBuildingStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Omits the revoke rule; this role cannot be revoked from anyone
   *
   * @returns next building step
   */
  public omitRevokeRule(): RoleFlagSettingStep {
    return new RoleFlagSettingStep(this.ctx, this.request);
  }

  /**
   * Sets one or multiple revoke rules for the role
   *
   * @param rules array of revoke rules specified in org-lang
   * @returns next building-step
   */
  public setRevokeRules(rules: string[]): RoleFlagSettingStep {
    this.request.ruleHashes.push(
      ...rules.map((rule) => computeRuleHash(rule, "revoke"))
    );
    return new RoleFlagSettingStep(this.ctx, this.request);
  }
}

/**
 * Building-step for setting the role flag of a role
 */
class RoleFlagSettingStep extends TestBuildingStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Sets the role-flag to a specified value
   *
   * @param roleFlag role-flag for the new role
   * @returns next building-step
   */
  public setRoleFlagTo(roleFlag: bigint): AddRoleFinalizationStep {
    this.request.roleFlag = roleFlag;
    return new AddRoleFinalizationStep(this.ctx, this.request);
  }

  /**
   * Tries to deduce a role-flag automatically by picking one of the
   * free role-flags
   *
   * @returns next building-step
   */
  public setRoleFlagAutomatically(): AddRoleFinalizationStep {
    this.request.addPromise(
      this.ctx
        .computeAvailableRoleFlag()
        .then((roleFlag) => (this.request.roleFlag = roleFlag))
    );
    return new AddRoleFinalizationStep(this.ctx, this.request);
  }
}

/**
 * Final building-step for creating an add-role-request.
 * Out of the data specified by previous building-steps, this function
 * finally builds the actual request and offers a method to send it to
 * the test-instance.
 */
class AddRoleFinalizationStep extends AbstractFinalizationStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Send adding-role-request to the test-instance
   *
   * @returns instance of DynBitVectorTestContext for testing various properties of the
   *          request and the test-instance
   */
  public send(): Testbench<DynBVOrgChartTestContext, DynamicBitVectorOrgChart> {
    this.reorder();
    return new Testbench(this.ctx, this.createRequest());
  }

  /**
   * Internal function for creating the actual request.
   */
  private async createRequest() {
    const approval = await this.computeApproval();

    await this.request.getPromise();

    await this.ctx.instance.addRole(approval, {
      roleId: this.request.roleId,
      roleFlag: this.request.roleFlag,
      ruleHashes: this.request.ruleHashes,
      seniorFlags: this.request.seniorFlags,
      juniorFlags: this.request.juniorFlags,
    });
  }
}

/**
 * Initial building-step for testing an remove-role-request
 */
export class RemoveRoleTestInitStep extends SignatureBuilderInitStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest,
  RemoveRoleFinalizationStep
> {
  public constructor(ctx: DynBVOrgChartTestContext, role: string) {
    super(
      ctx,
      new AdminRequest(role, "remove"),
      (ctx, request) => new RemoveRoleFinalizationStep(ctx, request)
    );
  }
}

export class RemoveRoleFinalizationStep extends AbstractFinalizationStep<
  DynBVOrgChartTestContext,
  DynamicBitVectorOrgChart,
  AdminRequest
> {
  /**
   * Send removing-role-request to the test-instance
   *
   * @returns instance of DynBitVectorTestContext for testing various properties of the
   *          request and the test-instance
   */
  public send(): Testbench<DynBVOrgChartTestContext, DynamicBitVectorOrgChart> {
    this.reorder();
    return new Testbench(this.ctx, this.createRequest());
  }

  /**
   * Internal function for creating the actual request.
   */
  private async createRequest() {
    const approval = await this.computeApproval();

    await this.request.getPromise();
    await this.ctx.instance.removeRole(approval, this.request.roleId);
  }
}
