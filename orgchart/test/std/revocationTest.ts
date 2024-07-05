import { ethers } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { BVOrgChartTestContext } from "../utils";
import { ERR_MSGS } from "../utils/common";

chai.use(chaiAsPromised);

export const RevocationTest = (
  contract: string,
  ctx: () => BVOrgChartTestContext = undefined
) => {
  describe(`revocation tests (${contract})`, () => {
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

      // building up some roles
      await context.grantRole(signers[1], "A", "root");
      await context.grantRole(signers[2], "A", "root");
      await context.grantRole(signers[3], "B", "root");
      await context.grantRole(signers[4], "B", "root");
      await context.grantRole(signers[5], "C", "root");
      await context.grantRole(signers[6], "AA", "root");
      await context.grantRole(signers[7], "AB", "root");
    });

    it("must revoke role AB if root, two As and two Bs sign", async () => {
      const nominee = context.addressBook.getUserOfRole("AB");

      const test = context
        .testRevoking("AB")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 2],
          ["B", 2],
        ])
        .usingRule("root, A(2), B(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "AB");
      await context.grantRole(nominee, "AB", "root");
    });

    it("must not crash if role is removed, that the user does not have", async () => {
      const nominee = context.addressBook.getUserOfRole("AB");

      const test = context
        .testRevoking("A")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      // TODO: Needs to be discussed if that should raise an error
      await test.expectSuccess();
      await test.expectHavingRole(nominee, "AB");
      await test.expectNotHavingRole(nominee, "A");
    });

    it("must not revoke rules if signatures were not sufficient", async () => {
      const nominee = context.addressBook.getUserOfRole("AB");

      const test = context
        .testRevoking("AB")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 2],
          ["B", 1],
        ])
        .usingRule("root(1), A(2), B(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.NOT_ENOUGH_SIGNERS);
      await test.expectHavingRole(nominee, "AB");
    });

    it("must not revoke rule if signatures are missing", async () => {
      const nominee = context.addressBook.getUserOfRole("AB");

      const test = context
        .testRevoking("AB")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 2],
          ["B", 1],
        ])
        .usingRule("root(1), A(2), B(2)")
        .setAssignmentManually([0, 1, 2, 3, 4])
        .send();

      await test.expectFail(ERR_MSGS.PERMISSION_DENIED);
      await test.expectHavingRole(nominee, "AB");
    });

    it("must not revoke unknown roles", async () => {
      const nominee = context.addressBook.getUserOfRole("AB");

      const test = context
        .testRevoking("UNKNOWN")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.UNKNOWN_ROLE);
      await test.expectHavingRole(nominee, "AB");
    });

    it("must not revoke role if too many signers have signed", async () => {
      const nominee = context.addressBook.getUserOfRole("A");

      const test = context
        .testRevoking("A")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["B", 2],
        ])
        .usingRule("root")
        .setAssignmentManually([0])
        .send();

      await test.expectFail(ERR_MSGS.INVALID_ASSIGNMENT);
      await test.expectHavingRole(nominee, "A");
    });

    it("must not cause problems if a user with no role is revoked from a role", async () => {
      const nominee = context.addressBook.getUnassignedUsers()[0];

      const test = context
        .testRevoking("A")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRoles(nominee, [
        "root",
        "A",
        "B",
        "C",
        "AA",
        "AB",
      ]);
    });

    it("must not revoke a role if the specified rule is incorrect", async () => {
      const nominee = context.addressBook.getUserOfRole("B");

      const test = context
        .testRevoking("B")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 2],
        ])
        .usingRule("root, A(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectHavingRole(nominee, "B");
    });

    it("must not revoke a non-revokable role", async () => {
      const nominee = context.addressBook.getUserOfRole("root");

      const test = context
        .testRevoking("root")
        .from(nominee)
        .setSignersHavingRoles([["A", 2]])
        .usingRule("A(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectFail(ERR_MSGS.INVALID_RULE);
      await test.expectHavingRole(nominee, "root");
    });

    it("must revoke role AA", async () => {
      const nominee = context.addressBook.getUserOfRole("AA");

      const test = context
        .testRevoking("AA")
        .from(nominee)
        .setSignersHavingRoles([
          ["root", 1],
          ["A", 2],
        ])
        .usingRule("root, A(2)")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "AA");
    });

    it("must revoke role C", async () => {
      const nominee = context.addressBook.getUserOfRole("C");

      const test = context
        .testRevoking("C")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "C");
    });

    it("must revoke role B", async () => {
      const nominee = context.addressBook.getUserOfRole("B");

      const test = context
        .testRevoking("B")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "B");
    });

    it("must revoke role A", async () => {
      const nominee = context.addressBook.getUserOfRole("A");

      const test = context
        .testRevoking("A")
        .from(nominee)
        .setSignersHavingRoles([["root", 1]])
        .usingRule("root")
        .deduceAssignmentFromSigners()
        .send();

      await test.expectSuccess();
      await test.expectNotHavingRole(nominee, "A");
    });
  });
};
