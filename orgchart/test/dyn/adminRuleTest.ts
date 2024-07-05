import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext, ERR_MSGS } from "../utils";

chai.use(chaiAsPromised);

describe("admin-rules test", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    const roles = ["root", "A", "B", "C"];
    signers = (await ethers.getSigners()).map((signer) => signer.address);

    context = await DynBVOrgChartTestContext.from(
      "DynAdminRuleOrgChart",
      [
        ["root", signers[0]],
        ["root", signers[1]],
        ["A", signers[2]],
        ["A", signers[3]],
        ["A", signers[4]],
        ["B", signers[5]],
        ["B", signers[6]],
      ],
      roles
    );
  });

  it("should allow adding a role if two root, one A and one B sign", async () => {
    const test = context
      .testAddingRole("DMY1")
      .setSignersHavingRoles([
        ["root", 2],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("root(2), A, B")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it("should allow removing a role if two root, one A and one B sign", async () => {
    const test = context
      .testRemovingRole("DMY1")
      .setSignersHavingRoles([
        ["root", 2],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("root(2), A, B")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
  });

  it("should allow adding a role if one root (signs for A), one A and one B sign", async () => {
    const test = context
      .testAddingRole("DMY2")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("A(50%), B")
      .setAssignmentManually([0, 0, 1])
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it("should allow removing a role if one root (signs for A), one A and one B sign", async () => {
    const test = context
      .testRemovingRole("DMY2")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("A(50%), B")
      .setAssignmentManually([0, 0, 1])
      .send();

    await test.expectSuccess();
  });

  it("should not allow adding a role if one root signs for !A", async () => {
    const test = context
      .testAddingRole("DMY3")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["root", 1],
      ])
      .usingRule("!A(50%), root")
      .setAssignmentManually([0, 0, 1])
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
  });

  it("should not allow removing a role if one root signs for !A", async () => {
    const test = context
      .testRemovingRole("DEL")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["root", 1],
      ])
      .usingRule("!A(50%), root")
      .setAssignmentManually([0, 0, 1])
      .send();

    await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
  });

  it("should not allow adding a role if only 33% of A sign", async () => {
    const test = context
      .testAddingRole("DMY3")
      .setSignersHavingRoles([
        ["A", 1],
        ["root", 1],
      ])
      .usingRule("!A(50%), root")
      .setAssignmentManually([0, 1])
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
  });

  it("should not allow removing a role if only 33% of A sign", async () => {
    const test = context
      .testRemovingRole("DEL")
      .setSignersHavingRoles([
        ["A", 1],
        ["root", 1],
      ])
      .usingRule("!A(50%), root")
      .setAssignmentManually([0, 1])
      .send();

    await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
  });

  it("should allow adding a role if an A, a B and root signs", async () => {
    const test = context
      .testAddingRole("DMY3")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("!root, !A, !B")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it("should allow removing a role if an A, a B and root signs", async () => {
    const test = context
      .testRemovingRole("DMY3")
      .setSignersHavingRoles([
        ["root", 1],
        ["A", 1],
        ["B", 1],
      ])
      .usingRule("!root, !A, !B")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
  });
});
