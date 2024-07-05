import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { DynBVOrgChartTestContext } from "../utils";
import { RevocationTest } from "../std/revocationTest";

chai.use(chaiAsPromised);

describe("dynamic rebuild test for RevocationOrgChart", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    const roles = ["admin"];
    signers = (await ethers.getSigners()).map((signer) => signer.address);

    context = await DynBVOrgChartTestContext.from(
      "EmptyOrgChart",
      // important to not conflict with others signers
      [["admin", signers[signers.length - 1]]],
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
      .setRevokeRules(["root"])
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
      .setGrantRules(["root"])
      .setRevokeRules(["root"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "C"', async () => {
    const test = context
      .testAddingRole("C")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["root"])
      .withJuniors([])
      .setGrantRules(["root"])
      .setRevokeRules(["root"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "AA"', async () => {
    const test = context
      .testAddingRole("AA")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .setGrantRules(["root"])
      .setRevokeRules(["root, A(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should add role "AB"', async () => {
    const test = context
      .testAddingRole("AB")
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .withSeniors(["A"])
      .withJuniors([])
      .setGrantRules(["root"])
      .setRevokeRules(["root, A(2), B(2)"])
      .setRoleFlagAutomatically()
      .send();

    await test.expectSuccess();
  });

  it('should allow granting role "root"', async () => {
    const root = signers[0];

    const test = context
      .testGranting("root")
      .to(root)
      .setSignersHavingRoles([["admin", 1]])
      .usingRule("admin")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
  });

  RevocationTest("EmptyOrgChart", () => context);
});
