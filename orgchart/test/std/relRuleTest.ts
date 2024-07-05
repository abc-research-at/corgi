import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { ERR_MSGS } from "../utils/common";
import { BVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

export const RelRuleTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`relative-rule test (${contract})`, () => {
    let context: BVOrgChartTestContext;
    let signers: string[];

    before(async () => {
      signers = (await ethers.getSigners()).map((signer) => signer.address);
      if (ctx === undefined) {
        context = await BVOrgChartTestContext.from(contract, [
          ["root", signers[0]],
          ["root", signers[1]],
        ]);
      } else {
        context = ctx();
      }
    });

    it("must grant role A if a root signs", async () => {
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

    it("must not grant role B if only one out of two roots and the nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]], true)
        .usingRule("!root(100%), self")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must grant role B if two out of two roots and the nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["root", 2]], true)
        .usingRule("!root(100%), self")
        .setAssignmentManually([0, 0])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B");
    });

    it("must not allow granting role A1 if no one signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSigners([])
        .usingRule("A(50%)")
        .setAssignmentManually([])
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "A");
    });

    it("must allow granting role A1 if one root signs (and there are no A)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("A(50%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must not allow granting role A1 if one root signs (and there are three As)", async () => {
      const [firstA, secondA, nominee] =
        context.addressBook.getUnassignedUsers();

      await context.grantRole(firstA, "A", "root");
      await context.grantRole(secondA, "A", "root");

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("A(50%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "A1");
    });

    it("must allow granting role A1 if one root and one A sign (and there are three As)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 1],
        ])
        .usingRule("A(50%)")
        .setAssignmentManually([0, 0])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must not allow granting role A1 if one root and one B sings (and there are three As)", async () => {
      const [thirdA, nominee] = context.addressBook.getUnassignedUsers();

      await context.grantRole(thirdA, "A", "root");

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["B", 1],
        ])
        .usingRule("A(50%)")
        .setAssignmentManually([0, 0])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A1");
    });

    it("must allow granting role A1 if two As sing (and there are three As)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A1")
        .to(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A(50%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A1");
    });

    it("must not allow granting role A2 if a root, an A and an A1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["root", 1],
          ["A1", 1],
        ])
        .usingRule("!A(50%), A1")
        .setAssignmentManually([0, 0, 1])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "A2");
    });

    it("must allow granting role A2 if two As and one A1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 2],
          ["A1", 1],
        ])
        .usingRule("!A(50%), A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A2");
    });

    it("must allow granting role A2 if three As and one A1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A2")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 3],
          ["A1", 1],
        ])
        .usingRule("!A(50%), A1")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A2");
    });

    it("must allow granting role B1 if two Bs sign", async () => {
      const [otherB, nominee] = context.addressBook.getUnassignedUsers();

      const testGrantingB = context
        .testGranting("B")
        .to(otherB)
        .setSignersHavingRoles([["root", 2]], true)
        .usingRule("!root(100%), self")
        .deduceAssignmentFromSigners()
        .send();

      await testGrantingB.expectSuccess();

      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 2]])
        .usingRule("B(25%),!B")
        .setAssignmentManually([0, 1])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must not allow granting role B1 if less than 25% Bs sign", async () => {
      const otherNoms = context.addressBook
        .getAllUsersBut(["root", "B"])
        .slice(0, 7);

      for (const nom of otherNoms) {
        await context
          .testGranting("B")
          .to(nom)
          .setSignersHavingRoles([["root", 2]], true)
          .usingRule("!root(100%), self")
          .deduceAssignmentFromSigners()
          .send()
          .expectSuccess();
      }

      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 3]])
        .usingRule("B(25%),!B")
        .setAssignmentManually([0, 0, 1])
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must not allow granting role B1 if three out of nine Bs sign but a root signs for strictly B", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([
          ["B", 3],
          ["root", 1],
        ])
        .usingRule("B(25%),!B")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B1");
    });

    it("must allow granting role B1 if three out of nine Bs sign and an additional B sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B1")
        .to(nominee)
        .setSignersHavingRoles([["B", 4]])
        .usingRule("B(25%),!B")
        .setAssignmentManually([0, 0, 0, 1])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B1");
    });

    it("must not allow granting role B2 if one B signs as B1", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B2")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("!B1(33%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B2");
    });

    it("must allow granting role B2 if one out of one B1 sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B2")
        .to(nominee)
        .setSignersHavingRoles([["B1", 1]])
        .usingRule("!B1(33%)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B2");
    });
  });
};
