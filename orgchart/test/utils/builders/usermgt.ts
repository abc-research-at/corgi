import { BitVectorOrgChart, OrgChart } from "../../../typechain-types";
import { computeRoleId } from "../common";
import { UserManagementRequest } from "./Request";
import { TestBuildingStep } from "./TestBuildingStep";
import { TestContext } from "./TestContext";
import { SignatureBuilderInitStep } from "./signature";
import { Testbench } from "./Testbench";
import { AbstractFinalizationStep } from "./finalization";

/**
 * Start-Building-Step for creating a new grant- or revoke-request
 */
export class UserManagementTestInitStep<
  T extends TestContext<O>,
  O extends OrgChart
> extends TestBuildingStep<T, O, UserManagementRequest> {
  /**
   * Constructor
   *
   * @param ctx test-context
   * @param role role to grant/revoke
   * @param type type of the request (either grant or revoke)
   */
  public constructor(ctx: T, role: string, type: "grant" | "revoke") {
    super(ctx, new UserManagementRequest(type, role, computeRoleId(role)));
  }

  /**
   * Creator-function for the next building step (setting the nominee)
   * Does the same thing as the "to" function. However, in case of a
   * revoke-request the "from" function can be used to improve the readability
   * of the building process:
   * `test("revoke").from(nominee)` instead of `test("revoke").to(nominee)`
   *
   * @param nominee nominee of the request
   * @returns next building-step
   */
  public readonly from = (nominee: string) => this.to(nominee);

  /**
   * Creator-function for the next building step (setting the nominee)
   * Does the same thing as the "from" function. However, in case of a
   * grant-request the "to" function can be used to improve the readability
   * of the building process:
   * `test("grant").to(nominee)` instead of `test("grant").from(nominee)`
   *
   * @param nominee nominee of the request
   * @return next building-step
   */
  public to(
    nominee: string
  ): SignatureBuilderInitStep<
    T,
    O,
    UserManagementRequest,
    UserManagementFinalizationStep<T, O>
  > {
    this.request.nominee = nominee;
    return new SignatureBuilderInitStep(
      this.ctx,
      this.request,
      (ctx, req) => new UserManagementFinalizationStep(ctx, req)
    );
  }
}

/**
 * Final building-step for creating grant- or revoke-requests.
 * Out of the data specified by previous building-steps, this function
 * finally builds the actual request and offers a method to send it to
 * the test-instance.
 */
class UserManagementFinalizationStep<
  T extends TestContext<O>,
  O extends OrgChart
> extends AbstractFinalizationStep<T, O, UserManagementRequest> {
  /**
   * Sends the request to the test-instance
   *
   * @returns instance of OrgChartTestBench allowing to test the effects
   *          of the request.
   */
  public send(): Testbench<T, O> {
    this.reorder();
    return new Testbench(this.ctx, this.createRequest());
  }

  /**
   * Internal function for creating the actual request.
   */
  private async createRequest() {
    const approval = await this.computeApproval();

    if (this.request.type == "grant") {
      await this.ctx.instance
        .connect(this.ctx.getSigner())
        .grantRole(approval, this.request.nominee, this.request.roleId);
      this.ctx.addressBook.add(this.request.nominee, this.request.role);
    } else {
      await this.ctx.instance
        .connect(this.ctx.getSigner())
        .revokeRole(approval, this.request.nominee, this.request.roleId);
      this.ctx.addressBook.remove(this.request.nominee, this.request.role);
    }
  }
}
