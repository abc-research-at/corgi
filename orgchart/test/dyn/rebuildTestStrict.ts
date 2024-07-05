import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext } from "../utils";
import { StrictRuleTest } from "../std/strictRuleTest";

chai.use(chaiAsPromised);

describe("dynamic rebuild test for StrictRuleOrgChart", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    const roles = ["admin"];
    signers = (await ethers.getSigners()).map((signer) => signer.address);

    context = await DynBVOrgChartTestContext.from(
      "EmptyOrgChart",
      [["admin", signers[0]]],
      roles
    );
  });

  it("should add root role", async () => {
    const test = context
      .testAddingRole("root")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors([])
      .withJuniors([])
      .setGrantRules(["admin"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "A"', async () => {
    const test = context
      .testAddingRole("A")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["root"])
      .withJuniors([])
      .setGrantRules(["root"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "B"', async () => {
    const test = context
      .testAddingRole("B")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["root"])
      .withJuniors([])
      .setGrantRules(["!root"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "A1"', async () => {
    const test = context
      .testAddingRole("A1")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .setGrantRules(["!A, B"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "A2"', async () => {
    const test = context
      .testAddingRole("A2")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .setGrantRules(["!A1"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "B1"', async () => {
    const test = context
      .testAddingRole("B1")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["B"])
      .withJuniors([])
      .setGrantRules(["!B, self"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "B2"', async () => {
    const test = context
      .testAddingRole("B2")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["B"])
      .withJuniors([])
      .setGrantRules(["!B, root, !B1"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should allow granting role "root"', async () => {
    const root = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("root")
      .to(root)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
  });

  StrictRuleTest("EmptyOrgChart", () => context);
});
