import chai from "chai";
import { OrgChart } from "../../../typechain-types";
import { Address, Role } from "../common";
import { TestContext } from "./TestContext";

/**
 * Test bench for standard org-charts (non-dynamic). Offers methods
 * to test various properties of a grant- or revoke request and of the underlying
 * test instance (org-chart).
 */
export class Testbench<T extends TestContext<O>, O extends OrgChart> {
  /**
   * Constructor
   *
   * @param ctx test context to use
   * @param requestPromise promise of the request
   */
  public constructor(
    protected readonly ctx: T,
    public readonly requestPromise: Promise<void>
  ) {}

  /**
   * Expect that the request succeeds
   * @throws chai-assertion-error if request fails
   */
  public async expectSuccess(): Promise<void> {
    await chai.expect(this.requestPromise).to.eventually.be.fulfilled;
  }

  /**
   * Expects that the request fails; optionally one can define
   * the expected error message.UserManagementTestCreator
   *
   * @param withMsg expected error message (optional); have a look at the
   *                `ERR_MSGS` object defined in the `common.ts`
   * @throws chai-assertion-error if the request succeeds
   */
  public async expectFail(withMsg?: string): Promise<void> {
    const result = await chai.expect(this.requestPromise).to.eventually.be
      .rejected;

    if (withMsg) {
      chai.expect(result).to.have.property("message").equal(withMsg);
    }
  }

  /**
   * Expect a specified user having a specified role
   * @param user user to check
   * @param role role to check
   * @throws chai-assertion error if the user does not have the specified role
   */
  public expectHavingRole(user: Address, role: Role): Promise<void> {
    return this.expectUsersHavingRole([user], role);
  }

  /**
   * Expect a set of users having a specified role
   * @param users set of users (addresses) to check
   * @param role role to checkthrow new Error("Not implemented")
   * @throws chai-assertion error if the user does not have the specified role
   */
  public async expectUsersHavingRole(
    users: Address[],
    role: Role
  ): Promise<void> {
    await Promise.all(
      users.map(async (user) => {
        await chai.expect(this.ctx.hasRole(user, role)).to.eventually.be.true;
      })
    );
  }

  /**
   * Expect a user having a set of specified roles
   *
   * @param user user to check
   * @param roles set of roles to check
   * @throws chai-assertion-error if user does not have one or more
   *        of the specified roles
   */
  public async expectHavingRoles(user: Address, roles: Role[]): Promise<void> {
    await Promise.all(roles.map((role) => this.expectHavingRole(user, role)));
  }

  /**
   * Expect a set of users having a set of specified roles
   *
   * @param users set of users to check
   * @param roles set of roles to check
   * @throws chai-assertion-error if one or multiple users do not have one
   *        or more of the specified roles
   */
  public async expectUsersHavingRoles(
    users: Address[],
    roles: Role[]
  ): Promise<void> {
    await Promise.all(
      roles.map((role) => this.expectUsersHavingRole(users, role))
    );
  }

  /**
   * Expect a user not having a specified role
   *
   * @param user user to check
   * @param role role to check
   * @throws chai-assertion-error if user has the specified role
   */
  public expectNotHavingRole(user: Address, role: Role): Promise<void> {
    return this.expectUsersNotHavingRole([user], role);
  }

  /**
   * Expect a set of users not having a specified role
   *
   * @param users set of users to check
   * @param role role to check
   * @throws chai-assertion-error if one ore multiple users have the
   *         specified role
   */
  public async expectUsersNotHavingRole(
    users: Address[],
    role: Role
  ): Promise<void> {
    await Promise.all(
      users.map(async (user) => {
        await chai.expect(this.ctx.hasRole(user, role)).to.eventually.be.false;
      })
    );
  }

  /**
   * Expect a user not having a set of roles
   *
   * @param user user to check
   * @param roles role to check
   * @throws chai-assertion error if the user has one or more of
   *         the specified roles
   */
  public async expectNotHavingRoles(
    user: Address,
    roles: Role[]
  ): Promise<void> {
    await Promise.all(
      roles.map((role) => this.expectNotHavingRole(user, role))
    );
  }

  /**
   * Expect a set of users not having a set of roles
   *
   * @param users set of users to check
   * @param roles set of roles to check
   * @throws chai-assertion-error if one or more users do
   *         have one or more of the specified roles
   */
  public async expectUsersNotHavingRoles(
    users: Address[],
    roles: Role[]
  ): Promise<void> {
    await Promise.all(
      roles.map((role) => this.expectUsersNotHavingRole(users, role))
    );
  }
}
