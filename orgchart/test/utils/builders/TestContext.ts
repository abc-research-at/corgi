import {
  BitVectorOrgChart,
  DynamicBitVectorOrgChart,
  OrgChart,
} from "../../../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { AddressBook } from "../AddressBook";
import {
  Address,
  Role,
  computeFreeRolesBitMask,
  computeRoleId,
} from "../common";
import { UserManagementTestInitStep } from "./usermgt";
import { RuleParser } from "../RuleParser";
import { ethers, web3 } from "hardhat";
import { Request } from "./Request";
import { Signature } from "../Signature";
import { AddRoleTestInitStep, RemoveRoleTestInitStep } from "./admin";

/**
 * Holds all the information of the current test environment.
 * This class is also offers a convenient way to generate new
 * test cases.
 */
export class TestContext<O extends OrgChart> {
  private readonly address2Wallet: Map<string, SignerWithAddress>;
  public readonly addressBook: AddressBook;
  private defaultSigner: SignerWithAddress;

  /**
   * Constructor
   *
   * @param instance instance of the orgchart (system under test)
   * @param users array of users (addresses) that can be used for testing
   */
  protected constructor(
    public readonly instance: O,
    users: SignerWithAddress[]
  ) {
    this.address2Wallet = new Map(users.map((u) => [u.address, u]));
    this.addressBook = new AddressBook(users.map((u) => u.address));
    this.defaultSigner = users[0];
  }

  /**
   * Set the signer that is used to send the transaction
   *
   * @param defaultSigner
   */
  public setSigner(defaultSigner: string) {
    this.defaultSigner =
      this.address2Wallet.get(defaultSigner) ?? this.defaultSigner;
  }

  /**
   * Getter for the signer
   *
   * @returns object containing the signer
   */
  public getSigner(): SignerWithAddress {
    return this.defaultSigner;
  }

  /**
   * Starting point for creating a new test-case for granting a role.
   *
   * @param role role that should be granted in the context of the test
   * @returns instance of UserManagementTestCreator that can be used to
   *          define further properties of the test case.
   */
  public testGranting(role: Role): UserManagementTestInitStep<this, O> {
    return new UserManagementTestInitStep(this, role, "grant");
  }

  /**
   * Starting point for creating a new test-case for revoking a role.
   *
   * @param role role that should be revoked in the context of the test
   * @returns instance of UserManagementTestCreator that can be used to
   *          define further properties of the test case.
   */
  public testRevoking(role: Role): UserManagementTestInitStep<this, O> {
    return new UserManagementTestInitStep(this, role, "revoke");
  }

  /**
   * Checks if a certain user has a role by invoking the corresponding
   * smart-contract-function on the current test-instance. This function
   * will automatically take care of encoding of the role.
   *
   * @param user address of the user that should be checked
   * @param role role name; just pass the name as defined in the org-chart, I will
   *             take care of the rest
   * @returns `true` in case the user has the role, `false` otherwise.
   */
  public hasRole(user: Address, role: Role): Promise<boolean> {
    return this.instance.hasRole(user, computeRoleId(role));
  }

  /**
   * Checks if the address-book knows a user having a specified role.
   * If so, it returns that user, otherwise it will grant a new user the
   * specified role using the passed rule.
   *
   * @param role role that should be checked/granted
   * @param rule rule to use in order to grant the role if no user exists having that role
   * @returns the address of the user
   */
  public async findOrGrant(role: Role, rule: string): Promise<Address> {
    try {
      return this.addressBook.getUserOfRole(role);
    } catch (err) {
      const nominee = this.addressBook.getUnassignedUsers()[0];
      return this.grantRole(nominee, role, rule);
    }
  }

  /**
   * Grant a specified role to a specified user (nominee) using a
   * specified rule.
   *
   * @param nominee user to grant role
   * @param role user to whom a role is to be granted
   * @param rule rule that should be used
   * @returns address of the user
   */
  public async grantRole(
    nominee: Address,
    role: Role,
    rule: string
  ): Promise<Address> {
    const [selfSignReq, atoms] = RuleParser.parse(rule);

    const required = atoms.map((a) => {
      if (!a.isRelative) return [a.role, a.qty] as [string, number];
      const abs = Math.ceil(
        (this.addressBook.getAllUsersOfRole(a.role).length * 100) / a.qty
      );
      return [a.role, abs] as [string, number];
    });

    const grant = this.testGranting(role)
      .to(nominee)
      .setSignersHavingRoles(required, selfSignReq)
      .usingRule(rule)
      .deduceAssignmentFromSigners()
      .send();
    await grant.expectSuccess();
    return nominee;
  }

  /**
   * Signs the request using all the signers specified in the request
   *
   * @returns tuple where the first entry contains the hash of the request
   *          and the second entry contains the block-hash that is used as a
   *          base-block, i.e. in order for the signature to be valid, the base-block
   *          must be within a certain distance to the block that contains the transaction
   *          for the actual request.
   *
   * @param request request to sign
   */
  public async signRequest(request: Request): Promise<[string, Signature[]]> {
    const baseBlockHash = await this.getLatestBlockHash();
    const domSep = await this.instance.DOMAIN_SEPARATOR();

    const hash = request.hash(domSep, baseBlockHash);
    return [baseBlockHash, await this.sign(hash, request.signers)];
  }

  /**
   * Creates a signatures (ECDSA) for a given hash using all the specified signers
   * of the request.
   *
   * @param hash hash that should be signed
   * @returns tuple containing the signatures for all signers,
   *          given the tuple `[sigV, sigR, sigS]` where all elements of the tuple
   *          are of type `string[]`, `sigR[i]` holds the first 32 bytes, `sigS[i]` holds the second
   *          32 bytes and `sigV[i]` the last 16 bytes of the signature of signer `i`
   */
  public async sign(hash: string, signers: string[]): Promise<Signature[]> {
    const r = (sig: string) => `0x${sig.substring(2, 66)}`;
    const s = (sig: string) => `0x${sig.substring(66, 130)}`;
    const v = (sig: string) => `0x${sig.substring(130, 132)}`;

    const sigs = await Promise.all(signers.map((s) => web3.eth.sign(hash, s)));

    return sigs.map((sig) => ({
      r: r(sig),
      s: s(sig),
      v: v(sig),
    }));
  }

  /**
   * Returns the hash of the last block observed on the blockchain
   * @returns hash of the last block
   */
  public async getLatestBlockHash(): Promise<string> {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block.hash;
  }
}

/**
 * Test context for standard org-charts (so non-dynamic).
 */
export class BVOrgChartTestContext extends TestContext<BitVectorOrgChart> {
  /**
   * Creates a new test context given the org-chart instance (system under test)
   * and an initial role assignment.
   *
   * @param contract name of the contract (needs to be an available artifact-name)
   * @param initialAssignment initial assignment of roles to users
   * @returns test context for the passed org-chart
   */
  public static async from(
    contract: string,
    initialAssignment: [Role, Address][]
  ): Promise<BVOrgChartTestContext> {
    const factory = await ethers.getContractFactory(contract);
    const instance = await factory.deploy(
      ...initialAssignment.map(([, u]) => u)
    );
    const signers = await ethers.getSigners();

    const ctx: BVOrgChartTestContext = new TestContext(
      instance as BitVectorOrgChart,
      signers
    );

    initialAssignment.forEach(([role, user]) =>
      ctx.addressBook.add(user, role)
    );
    return ctx;
  }
}

/**
 * Test context for dynamic org-charts.
 */
export class DynBVOrgChartTestContext extends TestContext<DynamicBitVectorOrgChart> {
  /**
   * Constructor
   *
   * @param instance instance of the orgchart (system under test)
   * @param users array of users (addresses) that can be used for testing
   * @param roles list of all roles in the org-chart; needed for certain automated checks
   */
  private constructor(
    instance: DynamicBitVectorOrgChart,
    users: SignerWithAddress[],
    public readonly roles: Role[]
  ) {
    super(instance, users);
  }

  /**
   * Creates a new test context given the org-chart instance (system under test),
   * an initial role assignment and a list of all roles available in the org-chart.
   *
   * @param contract name of the contract (needs to be an available artifact-name)
   * @param initialAssignment initial assignment of roles to users
   * @param roles list of all available roles in the org-chart
   * @returns test-context for the passed org-chart
   */
  public static async from(
    contract: string,
    initialAssignment: [Role, Address][],
    roles: string[]
  ): Promise<DynBVOrgChartTestContext> {
    const factory = await ethers.getContractFactory(contract);
    const instance = await factory.deploy(
      ...initialAssignment.map(([, u]) => u)
    );
    const signers = await ethers.getSigners();

    const ctx = new DynBVOrgChartTestContext(
      instance as DynamicBitVectorOrgChart,
      signers,
      roles
    );
    initialAssignment.forEach(([role, user]) =>
      ctx.addressBook.add(user, role)
    );
    return ctx;
  }

  /**
   * Starting point for creating a role-adding-test
   *
   * @param role name of the role that should be added
   * @returns instance of AddRoleTestCreator that allows
   *          to specify further options for the new role
   */
  public testAddingRole(role: string): AddRoleTestInitStep {
    return new AddRoleTestInitStep(this, role);
  }

  /**
   * Starting point for creating a role-removing-test
   *
   * @param role name of the role that should be removed
   * @returns instance of RemoveRoleTestCreator that allows
   *          to create new removing-tests
   */
  public testRemovingRole(role: string): RemoveRoleTestInitStep {
    return new RemoveRoleTestInitStep(this, role);
  }

  /**
   * Returns the role-flag of a certain role by requesting it from
   * the test-instance
   *
   * @param role name of the role; I'll take care of encoding myself
   * @returns bigint (max 256 bit) with the role-flag set to 1
   */
  public getRoleFlag(role: string): Promise<bigint> {
    return this.instance
      .roleId2Flag(computeRoleId(role))
      .then((n) => n.toBigInt());
  }

  /**
   * Returns the mask of a role by requesting it from the
   * test-instance
   *
   * @param role name of the role; I'll take care of encoding myself
   * @returns bigint (max 256 bit) describing the role-mask
   */
  public getRoleMask(role: string): Promise<bigint> {
    return this.getRoleFlag(role)
      .then((flag) => this.instance.roleFlag2Mask(flag))
      .then((n) => n.toBigInt());
  }

  /**
   * Returns the junior-mask of a role by requesting it from the
   * test-instance
   *
   * @param role name of the role; I'll take care of encoding myself
   * @returns bigint (max 256 bit) describing the junior-role-mask
   */
  public getJuniorMask(role: string): Promise<bigint> {
    return this.getRoleFlag(role)
      .then((flag) => this.instance.roleFlag2JuniorMask(flag))
      .then((n) => n.toBigInt());
  }

  /**
   * Returns the free-role-flags-bit-mask by requesting it from the
   * test-instance
   *
   * @returns a bit-mask which has all the available role-flags set to 1
   */
  public getFreeRoleFlags(): Promise<bigint> {
    return this.instance.freeRoleFlags().then((n) => n.toBigInt());
  }

  /**
   * Compute an role flag that is still available. The information about which
   * role-flags are already taken is directly retrieved from the test-instance
   *
   * @param ignore bitmask containing flags that should be ignored (default is 0)
   * @returns a role-flag that is not already taken
   */
  public async computeAvailableRoleFlag(ignore = BigInt(0)): Promise<bigint> {
    const freeRoleFlags = (await this.getFreeRoleFlags()) ^ ignore;
    const max = (BigInt(1) << BigInt(256)) - BigInt(1);
    if (freeRoleFlags == max) {
      throw new Error("Internal error: no further role flags available");
    }

    let curr = BigInt(1);
    for (curr; (curr & freeRoleFlags) != curr; curr = curr << BigInt(1));
    if (curr > max) {
      throw new Error("Fatal Error: bit masks invalid");
    }
    return curr;
  }

  /**
   * Getter returning the number of active roles by requesting it from
   * the test-instance
   *
   * @returns number of active roles
   */
  public getNumOfActiveRoles(): Promise<number> {
    return this.instance.numOfActiveRoles();
  }

  /**
   * Validates if the free-role-flag mask of the test-instance
   * agrees with the data stored locally. In case it does not,
   * a chai-assertion error is thrown.
   */
  public async validateFreeRolesBitmask(): Promise<void> {
    const roleFlags = await Promise.all(
      this.roles.map((role) => this.getRoleFlag(role))
    );
    const taken = roleFlags.reduce((a, b) => a | b, BigInt(0));
    const expected = computeFreeRolesBitMask(taken);

    await chai.expect(this.getFreeRoleFlags()).to.eventually.equal(expected);
  }
}
