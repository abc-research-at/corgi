import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils";
import { ERR_MSGS } from "../utils/common";

chai.use(chaiAsPromised);

export const BasicOrgChartTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`basic org chart test (${contract})`, () => {
    let context: BVOrgChartTestContext;
    let signers: string[];

    before(async () => {
      signers = (await ethers.getSigners()).map((signer) => signer.address);
      if (ctx === undefined) {
        context = await BVOrgChartTestContext.from(contract, [
          ["A", signers[0]],
          ["A", signers[1]],
        ]);
      } else {
        context = ctx();
      }
    });

    it("must grant role B if A signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("A(1)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "B");
      await test.expectNotHavingRoles(nominee, ["A", "C"]);
    });

    it("must not grant role if no one signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      const test = context
        .testGranting("B")
        .to(nominee)
        .setSigners([])
        .usingRule("A(1)")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must not grant role if the person does not have the claimed role (no role instead)", async () => {
      const unassigned = context.addressBook.getUnassignedUsers();
      const someone = unassigned[0];
      const nominee = unassigned[1];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSigners([someone])
        .usingRule("A(1)")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must not grant role if the person does not have the claimed role (lower role instead)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("A(1)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must not grant role if the passed rule is wrong (although person has necessary permission)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("B(1)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must not grant role if the passed rule is wrong (and person does not have necessary permissions)", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["B", 1]])
        .usingRule("B(1)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must not grant role if the passed rule is wrong (and person does not even have wrongly claimed permission)", async () => {
      const unassigned = context.addressBook.getUnassignedUsers();
      chai.assert(
        unassigned.length > 1,
        "Need more addresses to execute this test"
      );
      const someone = unassigned[0];
      const nominee = unassigned[1];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSigners([someone])
        .usingRule("B(1)")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectNotHavingRole(nominee, "B");
    });

    it('must grant role "C" if A and B sign', async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("C")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["B", 1],
        ])
        .usingRule("A(1), B(1)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "C");
    });

    it('must grant role "C" if two As sign', async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("C")
        .to(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A(1), B(1)")
        .setAssignmentManually([0, 1])
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "C");
    });

    it('must not grant role "C" if assignment is incorrect', async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("C")
        .to(nominee)
        .setSignersHavingRoles([
          ["A", 1],
          ["B", 1],
        ])
        .usingRule("A(1), B(1)")
        .setAssignmentManually([1, 0])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "C");
    });

    it('must not grant role "C" if two Bs sign', async () => {
      const unassigned = context.addressBook.getUnassignedUsers();
      const anotherB = unassigned[0];
      const nominee = unassigned[1];

      const grantAnotherB = context
        .testGranting("B")
        .to(anotherB)
        .setSignersHavingRoles([["A", 1]])
        .usingRule("A(1)")
        .deduceAssignmentFromSigners()
        .send();
      await grantAnotherB.expectSuccess();

      const test = context
        .testGranting("C")
        .to(nominee)
        .setSignersHavingRoles([["B", 2]])
        .usingRule("A(1), B(1)")
        .setAssignmentManually([0, 1])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectNotHavingRole(nominee, "C");
    });

    it("must fail if an unknown role is granted", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("UNKNOWN")
        .to(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.UNKNOWN_ROLE);
      await test.expectNotHavingRoles(nominee, ["A", "B", "C"]);
    });

    it("must give As permissions of As", async () => {
      const [, a] = context.addressBook.getUserOfRole("A");
      chai.expect(context.hasRole(a, "A")).to.eventually.be.true;
    });

    it("must give As permissions of Bs", async () => {
      const [, a] = context.addressBook.getUserOfRole("A");
      chai.expect(context.hasRole(a, "B")).to.eventually.be.true;
    });

    it("must give As permissions of Cs", async () => {
      const [, a] = context.addressBook.getUserOfRole("A");
      chai.expect(context.hasRole(a, "C")).to.eventually.be.true;
    });

    it("must not give Bs permissions of As", async () => {
      const [, a] = context.addressBook.getUserOfRole("B");
      chai.expect(context.hasRole(a, "A")).to.eventually.be.false;
    });

    it("must not give Cs permissions of As", async () => {
      const [, a] = context.addressBook.getUserOfRole("C");
      chai.expect(context.hasRole(a, "A")).to.eventually.be.false;
    });

    it("must not give Bs permissions of Cs", async () => {
      const [, a] = context.addressBook.getUserOfRole("B");
      chai.expect(context.hasRole(a, "C")).to.eventually.be.false;
    });

    it("must not give Cs permissions of Bs", async () => {
      const [, a] = context.addressBook.getUserOfRole("C");
      chai.expect(context.hasRole(a, "B")).to.eventually.be.false;
    });
  });
};
