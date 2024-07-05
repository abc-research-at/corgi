import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { BVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

export const DemoSmall = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`demo small (${contract})`, () => {
    let context: BVOrgChartTestContext;
    let signers: string[];

    before(async () => {
      signers = (await ethers.getSigners()).map((signer) => signer.address);
      if (ctx === undefined) {
        context = await BVOrgChartTestContext.from(contract, [
          ["DSO", signers[0]],
          ["DSO", signers[1]],
        ]);
      } else {
        context = ctx();
      }
    });

    it("should grant role DSO if two other DSOs and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("DSO")
        .to(nominee)
        .setSignersHavingRoles([["DSO", 2]], true)
        .usingRule("DSO(2), self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "DSO");
    });

    it("should grant role DIR if two DSO sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("DIR")
        .to(nominee)
        .setSignersHavingRoles([["DSO", 2]])
        .usingRule("DSO(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "DIR");
    });

    it("should grant role PL1 if two DIRs sign", async () => {
      const [nominee, otherDIR] = context.addressBook.getUnassignedUsers();

      await context.grantRole(otherDIR, "DIR", "DSO(2)");

      const test = context
        .testGranting("PL1")
        .to(nominee)
        .setSignersHavingRoles([["DIR", 2]])
        .usingRule("DIR(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "PL1");
    });
  });
};
