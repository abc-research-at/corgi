import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils/";

chai.use(chaiAsPromised);

export const HierarchyTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`hierarchy-inheritance tests (${contract})`, () => {
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

    it("must give root permissions of A", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "A")).to.eventually.be.true;
    });

    it("must give root permissions of B", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "B")).to.eventually.be.true;
    });

    it("must give root permissions of C", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "C")).to.eventually.be.true;
    });

    it("must give root permissions of XA", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "XA")).to.eventually.be.true;
    });

    it("must give root permissions of AAA", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "AAA")).to.eventually.be.true;
    });

    it("must not give root permissions of root2", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "C")).to.eventually.be.true;
    });

    it("must not give root permissions of Z", async () => {
      const root = context.addressBook.getUserOfRole("root");
      await chai.expect(context.hasRole(root, "C")).to.eventually.be.true;
    });

    it("must give AA permissions of X", async () => {
      const aa = await context.findOrGrant("AA", "root");
      await chai.expect(context.hasRole(aa, "X")).to.eventually.be.true;
    });

    it("must give AB permissions of X", async () => {
      const ab = await context.findOrGrant("AB", "root");
      chai.expect(context.hasRole(ab, "X")).to.eventually.be.true;
    });

    it("must give root2 permissions of Z", async () => {
      const root2 = await context.findOrGrant("root2", "root");
      chai.expect(context.hasRole(root2, "Z")).to.eventually.be.true;
    });

    it("must not give Z permissions of XA", async () => {
      const z = await context.findOrGrant("Z", "root");
      chai.expect(context.hasRole(z, "XA")).to.eventually.be.false;
    });

    it("must not give root2 permission of XA", async () => {
      const root2 = await context.findOrGrant("root2", "root");
      chai.expect(context.hasRole(root2, "XA")).to.eventually.be.false;
    });
  });
};
