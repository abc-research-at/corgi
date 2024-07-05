import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

export const PerformanceTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`performance test (${contract})`, () => {
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

    it("must grant role A, B and C if root signs", async () => {
      const nominees = context.addressBook.getUnassignedUsers();

      await context.grantRole(nominees[0], "A", "root");
      await context.grantRole(nominees[1], "B", "root");
      await context.grantRole(nominees[2], "C", "root");
    });
    it("must grant A another two times if root signs", async () => {
      const nominees = context.addressBook.getUnassignedUsers();

      await context.grantRole(nominees[0], "A", "root");
      await context.grantRole(nominees[1], "A", "root");
    });
    it("must grant role A1 if two As and the nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      await context.grantRole(nominee, "A1", "A(2), self");
    });
    it("must grant role A2 if an A, and A1 and the nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      await context.grantRole(nominee, "A2", "A, A1, self");
    });
    it("must grant role A3 if an A and the nominee sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      await context.grantRole(nominee, "A3", "A, self");
    });
    it("must grant role dummy, if all necessary signers sign", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];
      await context.grantRole(nominee, "dummy", "A(3), B, C, A1, A2, A3, self");
    });
  });
};
