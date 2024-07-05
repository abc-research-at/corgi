import { ethers } from "hardhat";
import { DynBVOrgChartTestContext, ERR_MSGS } from "../utils";

describe("basic role-removing test", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];
  let roleFlagBuffer: bigint;

  before(async () => {
    const roles = [
      "root",
      "top",
      "A",
      "B",
      "A1",
      "A2",
      "B1",
      "B2",
      "A11",
      "A12",
      "A21",
      "A22",
      "B11",
      "B12",
      "B21",
      "B22",
    ];
    signers = (await ethers.getSigners()).map((signer) => signer.address);
    context = await DynBVOrgChartTestContext.from(
      "DynSimpleRoleDeletionOrgChart",
      [["root", signers[0]]],
      roles
    );

    context.setSigner(signers[0]);

    const nominees = context.addressBook.getUnassignedUsers();
    await context.grantRole(nominees[0], "top", "root");
    await context.grantRole(nominees[1], "A", "root");
    await context.grantRole(nominees[2], "B", "root");
    await context.grantRole(nominees[3], "A1", "root");
    await context.grantRole(nominees[4], "A2", "root");
    await context.grantRole(nominees[5], "B1", "root");
    await context.grantRole(nominees[6], "B2", "root");
    await context.grantRole(nominees[7], "A11", "root");
    await context.grantRole(nominees[8], "A12", "root");
    await context.grantRole(nominees[9], "A21", "root");
    await context.grantRole(nominees[10], "A22", "root");
    await context.grantRole(nominees[11], "B11", "root");
    await context.grantRole(nominees[12], "B12", "root");
    await context.grantRole(nominees[13], "B21", "root");
    await context.grantRole(nominees[14], "B22", "root");

    context.setSigner(signers[0]);
  });

  it("must properly delete leaf-role", async () => {
    const test = context
      .testRemovingRole("A21")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
  });

  it("must not allow to grant deleted role", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("A21")
      .to(user)
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectFail(ERR_MSGS.UNKNOWN_ROLE);
  });

  it("must properly delete intermediate roles", async () => {
    roleFlagBuffer = await context.getRoleFlag("A2");
    const a2 = context.addressBook.getUserOfRole("A2");

    const test = context
      .testRemovingRole("A2")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();

    await test.expectNotHavingRole(
      context.addressBook.getUserOfRole("A"),
      "A22"
    );
    await test.expectNotHavingRole(
      context.addressBook.getUserOfRole("top"),
      "A22"
    );

    await test.expectNotHavingRoles(a2, ["A22"]);
  });

  it("must not allow to grant deleted role", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("A2")
      .to(user)
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectFail(ERR_MSGS.UNKNOWN_ROLE);
  });

  it("must not allow to re-use old role-flag", async () => {
    /* Note: 
    This test is not safe in the sense that is highly
    implementation dependent. However, since preventing re-using
    old role-flags is crucial for security in this implementation
    we needed to add this test. Be aware that this test case might
    fail in case of severe changes in the implementation
    */

    const test = await context
      .testAddingRole("DMY")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagTo(roleFlagBuffer)
      .send();

    await test.expectFail(ERR_MSGS.ROLE_FLAG_TAKEN);
  });

  it("must allow grant isolated role", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("A22")
      .to(user)
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectHavingRole(user, "A22");
  });

  it("must allow re-insert deleted role", async () => {
    const test = context
      .testAddingRole("A2")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors(["A21", "A22"])
      .setGrantRules(["root"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();

    await test.expectHavingRole(context.addressBook.getUserOfRole("A"), "A22");
    await test.expectHavingRole(
      context.addressBook.getUserOfRole("top"),
      "A22"
    );
  });

  it("must allow to split the orgchart by removing the root node", async () => {
    const top = context.addressBook.getUserOfRole("top");

    const test = context
      .testRemovingRole("top")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectNotHavingRoles(top, ["A", "B", "A1", "A2", "B1", "B2"]);
  });

  it("must allow to rejoin the orgchart by re-inserting the root node", async () => {
    const roleFlag = await context.computeAvailableRoleFlag();
    const test = context
      .testAddingRole("top")
      .setSignersHavingRoles([["root", 1]])
      .usingRule("root")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors(["A", "B"])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagTo(roleFlag)
      .send();

    await test.expectSuccess();

    await Promise.all(
      context.addressBook
        .getAllUsers()
        .map((user) => test.expectNotHavingRole(user, "top"))
    );
  });
});
