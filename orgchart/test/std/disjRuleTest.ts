import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { ERR_MSGS } from "../utils/common";
import { BVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

export const DisRuleTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`disjunctive-rule test (${contract})`, () => {
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
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B");
    });

    it("must grant role A1 if one A1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("A")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must grant role A1 if two A1s and the nominee sign", async () => {
      const [otherA, nominee] = context.addressBook.getUnassignedUsers();

      await context.grantRole(otherA, "A1", "A");

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["A1", 2]], true)
        .usingRule("A1(2), self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must not grant role A1 if using an invented rule", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectNotHavingRole(nominee, "A1");
    });

    it("must grant role A1 if an A, an A1 and the nominee signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles(
          [
            ["A", 1],
            ["A1", 1],
          ],
          true
        )
        .usingRule("A1(2), self")
        .setAssignmentManually([0, 0])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must grant role A2 if root signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("!root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A2");
    });

    it("must grant role A2 if A signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("!A")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A2");
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

    it("must not grant role A2 if A signs but using the wrong rule", async () => {
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

    it("must grant role B1 if one B signs using non-strict rule", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must grant role B1 if one B signs using strict rule", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("!B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must not grant role B1 if one out of three As sign", async () => {
      const [secondA, thirdA, nominee] =
        context.addressBook.getUnassignedUsers();

      await context.grantRole(secondA, "A", "root");
      await context.grantRole(thirdA, "A", "root");

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("A(50%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must grant role B1 if two out of four As sign", async () => {
      const [fourthA, nominee] = context.addressBook.getUnassignedUsers();

      await context.grantRole(fourthA, "A", "root");

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A(50%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must not grant role B1 if one root signs using strict rule", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("!B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must grant role B1 if one root signs using non-strict rule", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must revoke role B2 if one B signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      await context.grantRole(nominee, "B2", "root");

      const test = context
        .testRevoking("B2")
        .from(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("!B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "B2");
    });

    it("must revoke role B2 if one A and one A1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      await context.grantRole(nominee, "B2", "root");

      const test = context
        .testRevoking("B2")
        .from(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["A1", 1],
        ])
        .usingRule("A, A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "B2");
    });

    it("must revoke role B2 if two As sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      await context.grantRole(nominee, "B2", "root");

      const test = context
        .testRevoking("B2")
        .from(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A, A1")
        .setAssignmentManually([0, 1])
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "B2");
    });
  });
};
