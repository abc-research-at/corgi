import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils";
import { ERR_MSGS } from "../utils/common";

chai.use(chaiAsPromised);

export const StrictRuleTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`strict-rule test (${contract})`, () => {
    let context: BVOrgChartTestContext;
    let signers: string[];

    before(async () => {
      signers = (await ethers.getSigners()).map((signer) => signer.address);
      if (ctx === undefined) {
        context = await BVOrgChartTestContext.from(contract, [
          ["root", signers[0]],
        ]);
      } else {
        context = ctx();
      }
    });

    it("must grant role A if root signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A");
    });

    it("must grant role B if root signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("!root")
        .deduceAssignmentFromSigners()
        .send();
      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B");
    });

    it("must not grant role A1 if root and B sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["B", 1],
        ])
        .usingRule("!A, B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A1");
    });

    it("must grant role A1 if A and B sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["B", 1],
        ])
        .usingRule("!A, B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must grant role A1 if A and root sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["root", 1],
        ])
        .usingRule("!A, B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must not grant role A2 if root signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("!A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A2");
    });

    it("must not grant role A2 if A signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("!A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A2");
    });

    it("must not grant role A2 if B signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("!A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A2");
    });

    it("must grant role A2 if A1 signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["A1", 1]])
        .usingRule("!A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A2");
    });

    it("must not grant role B1 if root and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]], true)
        .usingRule("!B, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must not grant role B1 if A and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]], true)
        .usingRule("!B, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must grant role B1 if B and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]], true)
        .usingRule("!B, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must not grant role B2 if B signs as B1", async () => {
      const [otherB, nominee] = context.addressBook.getUnassignedUsers();

      await context.grantRole(otherB, "B", "!root");
      const test = context
        .testGranting("B2")
        .to(nominee)
        .setSignersHavingRoles([
          ["B", 2],
          ["root", 1],
        ])
        .usingRule("!B, root, !B1")
        .setAssignmentManually([0, 2, 1])
        .send();

      await test.expectFail();
      await test.expectNotHavingRole(nominee, "B2");
    });

    it("must grant role B2 if B, root and B1 signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B2")
        .to(nominee)
        .setSignersHavingRoles([
          ["B", 1],
          ["root", 1],
          ["B1", 1],
        ])
        .usingRule("!B, root, !B1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B2");
    });
  });
};
