import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  DynBVOrgChartTestContext,
  ERR_MSGS,
  computeFreeRolesBitMask,
} from "../utils";

chai.use(chaiAsPromised);

describe("basic role-adding test", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    const roles = ["A", "B", "C", "AA", "AB", "BA", "BB", "CA", "CB"];
    signers = (await ethers.getSigners()).map((signer) => signer.address);

    context = await DynBVOrgChartTestContext.from(
      "DynSimpleRoleAddingOrgChart",
      [
        ["A", signers[0]],
        ["B", signers[1]],
        ["C", signers[2]],
      ],
      roles
    );
  });

  it("should add role if a users of A, B and C signs", async () => {
    const test = context
      .testAddingRole("AC")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .setGrantRules(["A"])
      .setRevokeRules(["A"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();

    const a = context.addressBook.getUserOfRole("A");
    const b = context.addressBook.getUserOfRole("B");
    const c = context.addressBook.getUserOfRole("C");

    await test.expectUsersHavingRole([a], "AC");
    await test.expectUsersNotHavingRole([b], "AC");
    await test.expectUsersNotHavingRole([c], "AC");
  });

  it("should allow granting newly added role", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];
    const test = context
      .testGranting("AC")
      .to(user)
      .setSignersHavingRoles([["A", 1]])
      .usingRule("A(1)")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectHavingRole(user, "AC");
    await test.expectNotHavingRoles(user, ["A", "B", "C"]);
  });

  it("should not allow granting a role with a wrong rule", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];
    const test = context
      .testGranting("AC")
      .to(user)
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectFail(ERR_MSGS.INVALID_RULE);
  });

  it("should not allow revoking the role with a wrong rule", async () => {
    const user = context.addressBook.getUserOfRole("AC");
    const test = context
      .testRevoking("AC")
      .from(user)
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectFail(ERR_MSGS.INVALID_RULE);
  });

  it("should allow revoking newly added rule from a user", async () => {
    const user = context.addressBook.getUserOfRole("AC");
    const test = context
      .testRevoking("AC")
      .from(user)
      .setSignersHavingRoles([["A", 1]])
      .usingRule("A")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectNotHavingRole(user, "AC");
  });

  it("should not allow adding role when using a wrong rule", async () => {
    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([["A", 1]])
      .usingRule("A")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.INVALID_ADMIN_RULE);
  });

  it("should not allow adding role when signers don't fulfill the rule", async () => {
    const ac = context.addressBook.getUnassignedUsers()[0];
    await context.grantRole(ac, "AC", "A");

    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["AC", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .setAssignmentManually([0, 1, 2])
      .withSeniors(["A"])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
  });

  it("should not add role when signers are missing", async () => {
    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("A, B, C")
      .setAssignmentManually([0, 1])
      .withSeniors(["A"])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
  });

  it("should not allow to add a role with the same name", async () => {
    const test = context
      .testAddingRole("AC")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.ROLE_ID_TAKEN);
  });

  it("should not allow to add a role with the role flag", async () => {
    const roleFlag = await context.getRoleFlag("A");

    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagTo(roleFlag)
      .send();

    await test.expectFail(ERR_MSGS.ROLE_FLAG_TAKEN);
  });

  it("should not allow to introduce cycles (directly)", async () => {
    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors(["A"])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.CYCLE_DETECTED);
  });

  it("should not allow to introduce cycles (indirectly)", async () => {
    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["AA"])
      .withJuniors(["A"])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.CYCLE_DETECTED);
  });

  it("should not allow to introduce cycles (multiple)", async () => {
    const test = context
      .testAddingRole("root")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["AA", "BA", "CA", "C"])
      .withJuniors(["A", "B", "C"])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.CYCLE_DETECTED);
  });

  it("should not allow to set an invalid senior-mask", async () => {
    const unused = await context.getFreeRoleFlags();

    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniorFlags(unused)
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.SENIORS_NOT_EXIST);
  });

  it("should not allow to set an invalid junior-mask", async () => {
    const unused = await context.getFreeRoleFlags();

    const test = context
      .testAddingRole("AD")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniorFlags(unused)
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.JUNIORS_NOT_EXIST);
  });
});
