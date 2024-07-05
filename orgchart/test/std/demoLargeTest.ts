import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { BVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

export const DemoLarge = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`demo large (${contract})`, () => {
    let context: BVOrgChartTestContext;
    let signers: string[];

    before(async () => {
      signers = (await ethers.getSigners()).map((signer) => signer.address);
      if (ctx === undefined) {
        context = await BVOrgChartTestContext.from(contract, [
          ["AD", signers[0]],
          ["AD", signers[1]],
        ]);
      } else {
        context = ctx();
      }
    });

    it("should grant role P if two AD and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("P")
        .to(nominee)
        .setSignersHavingRoles([["AD", 2]], true)
        .usingRule("AD(2), self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "P");
    });

    it("should grant role DoDD if P and nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("DoDD")
        .to(nominee)
        .setSignersHavingRoles([["P", 1]], true)
        .usingRule("P, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "DoDD");
    });

    it("should grant role PP if P and nominee signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("PP")
        .to(nominee)
        .setSignersHavingRoles([["P", 1]], true)
        .usingRule("P, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "PP");
    });
  });
};
