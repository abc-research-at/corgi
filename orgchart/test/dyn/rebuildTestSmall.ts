import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext, ERR_MSGS } from "../utils";
import { DemoSmall } from "../std/demoSmallTest";

chai.use(chaiAsPromised);

describe("dynamic rebuild test for DemoSmallOrgChart", () => {
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

  it('should add role "DSO"', async () => {
    const test = context
      .testAddingRole("DSO")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["root"])
      .withJuniors([])
      .setGrantRules(["DSO(2), self", "admin"])
      .setRevokeRules(["DSO(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "DIR"', async () => {
    const test = context
      .testAddingRole("DIR")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["DSO"])
      .withJuniors([])
      .setGrantRules(["DSO(2)"])
      .setRevokeRules(["DSO(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "PL1"', async () => {
    const test = context
      .testAddingRole("PL1")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["DIR"])
      .withJuniors([])
      .setGrantRules(["DIR(2)"])
      .setRevokeRules(["DIR(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "PL2"', async () => {
    const test = context
      .testAddingRole("PL2")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["DIR"])
      .withJuniors([])
      .setGrantRules(["DIR(2)"])
      .setRevokeRules(["DIR(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "PE1"', async () => {
    const test = context
      .testAddingRole("PE1")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["PL1"])
      .withJuniors([])
      .setGrantRules(["PL1, DIR"])
      .setRevokeRules(["PL1, DIR"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "QE1"', async () => {
    const test = context
      .testAddingRole("QE1")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["PL1"])
      .withJuniors([])
      .setGrantRules(["PL1, PE1"])
      .setRevokeRules(["PL1, PE1"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it("should grant DSO", async () => {
    const dso1 = context.addressBook.getUnassignedUsers()[0];
    const dso2 = context.addressBook.getUnassignedUsers()[1];

    const test1 = context
      .testGranting("DSO")
      .to(dso1)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test1.expectSuccess();

    const test2 = context
      .testGranting("DSO")
      .to(dso2)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test1.expectSuccess();
  });

  DemoSmall("EmptyOrgChart", () => context);
});
