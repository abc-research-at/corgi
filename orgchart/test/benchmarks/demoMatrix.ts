import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { ERR_MSGS } from "../utils/common";
import { DynBVOrgChartTestContext } from "../utils";

chai.use(chaiAsPromised);

describe("Demo: Matrix org-chart", () => {
  let context: DynBVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    const roles = [
      "root",
      "CEO",
      "COO",
      "CFO",
      "CHRO",
      "CPO",
      "CMO",
      "GM1",
      "GM2",
      "GM3",
      "GM4",
      "GM5",
      "PM1",
      "PM2",
      "PM3",
      "PM4",
      "PM5",
      "PPM1",
      "PPM2",
      "PPM3",
      "PPM4",
      "PPM5",
      "IN1",
      "IN2",
      "IN3",
      "IN4",
      "IN5",
    ];

    signers = (await ethers.getSigners()).map((s) => s.address);
    context = await DynBVOrgChartTestContext.from(
      "DynDemoHaeshOrgChart",
      [["CEO", signers[0]]],
      roles
    );
  });

  it("must allow the CEO to grant a root user", async () => {
    const root = context.addressBook.getUnassignedUsers()[0];

    const test = context
      .testGranting("root")
      .to(root)
      .setSignersHavingRoles([["CEO", 1]])
      .usingRule("CEO")
      .deduceAssignmentFromSigners()
      .send();

    await test.expectSuccess();
    await test.expectHavingRole(root, "root");
  });

  it("should not allow a CEO to grant herself the role root", async () => {
    const ceo = context.addressBook.getUserOfRole("CEO");

    const test = context
      .testGranting("root")
      .to(ceo)
      .setSigners([ceo])
      .usingRule("CEO")
      .setAssignmentManually([0])
      .send();

    await test.expectFail(ERR_MSGS.INVALID_SELF_SIGN);
    await test.expectNotHavingRole(ceo, "root");
  });
});
