import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext, ERR_MSGS } from "../utils";

chai.use(chaiAsPromised);

describe("dynamic inheritance test", () => {
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

  it("should allow to join subtrees", async () => {
    const test = context
      .testAddingRole("root")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors(["A", "B", "C"])
      .setGrantRules(["A, B, C"])
      .setRevokeRules(["A, B, C"])
      .setRoleFlagAutomatically()
      .send();

    const a = context.addressBook.getUserOfRole("A");
    const b = context.addressBook.getUserOfRole("B");
    const c = context.addressBook.getUserOfRole("C");

    await test.expectSuccess();
    await test.expectNotHavingRole(a, "root");
    await test.expectNotHavingRole(b, "root");
    await test.expectNotHavingRole(c, "root");
  });

  it("should allow granting newly added role", async () => {
    const root = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("root")
      .to(root)
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectHavingRoles(root, [
      "root",
      "A",
      "B",
      "C",
      "AA",
      "AB",
      "BA",
      "BB",
      "CA",
      "CB",
    ]);
  });

  it("should allow users of newly added root role to sign for junior roles (granting)", async () => {
    const newA = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("A")
      .to(newA)
      .setSignersHavingRoles([
        ["root", 1],
        ["C", 1],
      ])
      .usingRule("B, C")
      .setAssignmentManually([0, 1])
      .send();

    await test.expectSuccess();
    await test.expectHavingRoles(newA, ["A", "AA", "AB"]);
  });

  it("should allow users of newly added root role to sign for junior roles (admin)", async () => {
    const test = context
      .testAddingRole("DMY")
      .setSignersHavingRoles([
        ["A", 1],
        ["root", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .setAssignmentManually([0, 1, 2])
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();

    const root = context.addressBook.getUserOfRole("root");
    const a = context.addressBook.getUserOfRole("A");
    const b = context.addressBook.getUserOfRole("B");
    const c = context.addressBook.getUserOfRole("C");

    await test.expectNotHavingRole(root, "DMY");
    await test.expectNotHavingRole(a, "DMY");
    await test.expectNotHavingRole(b, "DMY");
    await test.expectNotHavingRole(c, "DMY");
  });

  it("should allow to introduce a new minimum role", async () => {
    const test = context
      .testAddingRole("INF")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .deduceAssignmentFromSigners()
      .withSeniors(["AA", "AB", "BA", "BB", "CA", "CB"])
      .withJuniors([])
      .setGrantRules(["A", "B", "C"])
      .setRevokeRules(["A", "B", "C"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();

    const root = context.addressBook.getUserOfRole("root");
    const a = context.addressBook.getUserOfRole("A");
    const b = context.addressBook.getUserOfRole("B");
    const c = context.addressBook.getUserOfRole("C");

    await test.expectHavingRole(root, "INF");
    await test.expectHavingRole(a, "INF");
    await test.expectHavingRole(b, "INF");
    await test.expectHavingRole(c, "INF");
  });

  it("should allow to grant newly introduced role", async () => {
    const newInf = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("INF")
      .to(newInf)
      .setSignersHavingRoles([["A", 1]])
      .usingRule("A")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectHavingRole(newInf, "INF");
  });

  it("should not give minimum role permissions of senior roles (grant)", async () => {
    const user = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("A")
      .to(user)
      .setSignersHavingRoles([
        ["INF", 1],
        ["C", 1],
      ])
      .usingRule("B, C")
      .setAssignmentManually([0, 1])
      .send();

    await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
  });

  it("should not give minimum role permissions of senior roles (admin)", async () => {
    const test = context
      .testAddingRole("DMY2")
      .setSignersHavingRoles([
        ["INF", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A, B, C")
      .setAssignmentManually([0, 1, 2])
      .withSeniors([])
      .withJuniors([])
      .omitGrantRules()
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
  });

  it("should break inheritance when intermediate roles are removed", async () => {
    const test1 = context
      .testRemovingRole("AA")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A,B,C")
      .deduceAssignmentFromSigners()
      .send();

    await test1.expectSuccess();

    const test2 = context
      .testRemovingRole("AB")
      .setSignersHavingRoles([
        ["A", 1],
        ["B", 1],
        ["C", 1],
      ])
      .usingRule("A,B,C")
      .deduceAssignmentFromSigners()
      .send();

    await test2.expectSuccess();

    const a = context.addressBook.getUserOfRole("A");
    const b = context.addressBook.getUserOfRole("B");
    const c = context.addressBook.getUserOfRole("C");

    await test2.expectNotHavingRole(a, "INF");
    await test2.expectHavingRole(b, "INF");
    await test2.expectHavingRole(c, "INF");
  });
});
