import { ethers, web3 } from "hardhat";
import { computeRoleId } from "../common";

export abstract class Request {
  public signers?: string[];
  public assignment?: number[];
  public selfSigned?: boolean;
  public nominee?: string;
  public atoms?: string[];
  private promise: Promise<any>;

  public constructor() {
    this.promise = Promise.resolve();
  }

  protected abstract encode(baseBlockHash): string;

  public hash(domainSep: string, baseBlockHash: string): string {
    const req = ethers.utils.keccak256(this.encode(baseBlockHash));

    return ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["string", "bytes32", "bytes32"],
        ["\x19\x01", domainSep, req]
      )
    );
  }

  public addPromise(promise: Promise<any>) {
    this.promise = this.promise.then(() => promise);
  }

  public getPromise(): Promise<any> {
    return this.promise;
  }
}

export class UserManagementRequest extends Request {
  private static USER_MGT_REQ_HASH =
    "0x4188b8d190b775104aa586eb6c5d6b815d12bb4e103b72d0d4937b62c85c778e";
  private static REQ_TYP_HASH = {
    grant: "0xa72fd109f1975359ff67bd5ebe67fb335d4d285dc5067f5b17f0aaa21f3d5084",
    revoke:
      "0x9e10ea5887e56efeb96d4464ee7be8e8f408f1a889563a625d293d9d970cc73f",
  };
  public type?: "grant" | "revoke";
  public role?: string;
  public roleId: string;

  public constructor(type: "grant" | "revoke", role: string, roleId: string) {
    super();
    this.type = type;
    this.role = role;
    this.roleId = roleId;
  }

  /**
   * Encoding function for a request (according to EIP-712)
   *
   * @param nominee nominee of the request (to whom to grant/from whom to revoke a role)
   * @param action grant or revoke
   * @param roleId if of the role that should be granted/revoked
   * @param baseBlockHash base block
   * @returns encoding of the request
   */
  protected encode(baseBlockHash: string): string {
    return web3.eth.abi.encodeParameters(
      ["bytes32", "address", "bytes32", "bytes32", "bytes32"],
      [
        UserManagementRequest.USER_MGT_REQ_HASH,
        this.nominee,
        UserManagementRequest.REQ_TYP_HASH[this.type],
        this.roleId,
        baseBlockHash,
      ]
    );
  }
}

export class AdminRequest extends Request {
  private static ADMIN_REQ_HASH =
    "0xf23ec0bb4210edd5cba85afd05127efcd2fc6a781bfed49188da1081670b22d8";
  private static REQ_TYP_HASH = {
    add: "0xb297726e9ba5e58dd2bdbcd29ed10ec45e1fba4092200e6f6574c595546e8a35",
    remove:
      "0xf3c1118b8decb364780535ddd1aec07c063af923a883cd0d003f1afbd5a4d20f",
  };
  public type?: "add" | "remove";
  public role?: string;
  public roleId: string;
  public seniorFlags?: bigint;
  public juniorFlags?: bigint;
  public roleFlag?: bigint;
  public ruleHashes?: string[];

  public constructor(role: string, type: "add" | "remove") {
    super();
    this.type = type;
    this.role = role;
    this.roleId = computeRoleId(role);
  }

  /**
   * Encoding function for a request (according to EIP-712)
   *
   * @param nominee nominee of the request (to whom to grant/from whom to revoke a role)
   * @param action grant or revoke
   * @param roleId if of the role that should be granted/revoked
   * @param baseBlockHash base block
   * @returns encoding of the request
   */
  protected encode(baseBlockHash: string): string {
    if (this.type === "add") return this.encodeAdd(baseBlockHash);
    return this.encodeRemove(baseBlockHash);
  }

  private encodeAdd(baseBlockHash: string): string {
    const rulesHash = ethers.utils.keccak256(
      web3.eth.abi.encodeParameters(["bytes32[]"], [this.ruleHashes])
    );

    return web3.eth.abi.encodeParameters(
      [
        "bytes32",
        "bytes32",
        "uint256",
        "uint256",
        "uint256",
        "bytes32",
        "bytes32",
      ],
      [
        AdminRequest.REQ_TYP_HASH.add,
        this.roleId,
        this.roleFlag.toString(10),
        this.seniorFlags.toString(10),
        this.juniorFlags.toString(10),
        rulesHash,
        baseBlockHash,
      ]
    );
  }

  private encodeRemove(baseBlockHash: string): string {
    return web3.eth.abi.encodeParameters(
      ["bytes32", "bytes32", "bytes32"],
      [AdminRequest.REQ_TYP_HASH.remove, this.roleId, baseBlockHash]
    );
  }
}
