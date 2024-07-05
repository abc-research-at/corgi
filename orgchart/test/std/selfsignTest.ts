import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils";
import { ERR_MSGS } from "../utils/common";

chai.use(chaiAsPromised);

export const SelfSignTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`self-sign test (${contract})`, () => {
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

    it("must grant role A if root an nominee signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]], true)
        .usingRule("root, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectHavingRole(nominee, "A");
    });
    it("must not grant role A if only root signs", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("A")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.MISSING_SELF_SIGN);
    });

    it("must not allow self-sign if not required", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testGranting("B")
        .to(nominee)
        .setSignersHavingRoles([["root", 1]], true)
        .usingRule("root, self")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectNotHavingRole(nominee, "B");
    });

    it('must not allow to sign as both, "self" and "root"', async () => {
      const nominee = context.addressBook.getUserOfRole("root");

      const test = context
        .testGranting("C")
        .to(nominee)
        .setSigners([nominee], true)
        .usingRule("root, self")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.INVALID_SIG_ORDER);
      await test.expectNotHavingRole(nominee, "C");
    });
  });
};
