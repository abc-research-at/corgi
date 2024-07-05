import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext, ERR_MSGS } from "../utils";
import { DemoSmall } from "../std/demoSmallTest";
import { RelRuleTest } from "../std/relRuleTest";

chai.use(chaiAsPromised);

describe("dynamic rebuild test for RelRuleOrgChart", () => {
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
      .setGrantRules(["!root(100%), self"])
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
      .setGrantRules(["A(50%)"])
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
      .setGrantRules(["!A(50%), A1"])
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
      .setGrantRules(["B(25%), !B"])
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
      .setGrantRules(["!B1(33%)"])
      .omitRevokeRule()
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should allow granting role "root"', async () => {
    const root1 = context.addressBook.getUnassignedUsers()[0];
    const root2 = context.addressBook.getUnassignedUsers()[1];

    const test1 = context
      .testGranting("root")
      .to(root1)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test1.expectSuccess();

    const test2 = context
      .testGranting("root")
      .to(root2)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test2.expectSuccess();
  });

  RelRuleTest("EmptyOrgChart", () => context);
});
