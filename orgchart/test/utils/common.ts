/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains some constant and function that are
 * used across the project. All of the function defined here
 * are only meant to be used for test purposes.
 */

import { ethers } from "hardhat";
import { RuleParser } from "./RuleParser";
import { Hash } from "./HashUtil";

/**
 * Returns the kecack256 hash of a string
 *
 * @param str string to hash
 * @returns hash of string
 */
export const hashString = (str: string) =>
  ethers.utils.keccak256(Buffer.from(str));

/**
 * Computes the role id given the role's unique name
 *
 * @param role name of the role
 * @returns hex string (prefixed with "0x") representing the role id
 */
export const computeRoleId = (role: string) => {
  const roleAsNum = BigInt(hashString(role));
  return toPrefixed256BitHexString(roleAsNum >> BigInt(16));
};

export type Address = string;
export type Role = string;

/**
 * Helper function, converting the actual error message to
 * an ethereum error message.
 *
 * @param msg actual error message
 * @returns solidity error message
 */
export const solidityErr = (msg: string) =>
  `VM Exception while processing transaction: reverted with reason string '${msg}'`;

export const ERR_MSGS = {
  CYCLE_DETECTED: solidityErr("Cycle detected"),
  INVALID_ARGUMENTS: solidityErr("Invalid arguments"),
  INVALID_ASSIGNMENT: solidityErr("Invalid assignment"),
  PERMISSION_DENIED: solidityErr(
    "Invalid assignment: At least one signer does not have the specified role"
  ),
  NOT_ENOUGH_SIGNERS: solidityErr("Not enough signers have signed the request"),
  INVALID_RULE: solidityErr("Invalid rule"),
  INVALID_ADMIN_RULE: solidityErr("Invalid admin-rule"),
  INVALID_SELF_SIGN: solidityErr("Nominee is not expected to sign"),
  INVALID_SIG_ORDER: solidityErr(
    "Signers need to be sorted in ascending order"
  ),
  JUNIORS_NOT_EXIST: solidityErr("One or more junior roles do not exist"),
  MISSING_SELF_SIGN: solidityErr("Missing signature of nominee"),
  ROLE_FLAG_TAKEN: solidityErr("Role flag already taken"),
  ROLE_ID_TAKEN: solidityErr("Role id already taken"),
  SENIORS_NOT_EXIST: solidityErr("One or more senior roles do not exist"),
  UNKNOWN_ACTION: solidityErr("Unknown action"),
  UNKNOWN_ROLE: solidityErr("Unknown role"),
  UNPURE_ROLE_FLAG: solidityErr("Only one bit is allowed to be set to 1"),
  MAXIMUM_NUM_RULES: solidityErr("Maximum number of rules exceeded"),
};

/**
 * 32-Byte hex string of zero
 */
export const ZERO_BYTES_32 = `0x${new Array(64).fill("0").join("")}`;

/**
 * Hash of the rule structure definition
 */
export const RULE_HASH =
  "0x64bddff132fc1c7cb4776ef381143d78d0f2f6873b824fa04d6c83665ba25c38";

/**
 * Given a bit-vector indicating all the taken roles, computes the
 * free-role-bit mask
 *
 * @param taken bit-vector of size 256 indicating taken role-flags
 * @returns free-role-bit mask
 */
export const computeFreeRolesBitMask = (taken: bigint) => {
  const all = (BigInt(1) << BigInt(256)) - BigInt(1);
  return all ^ taken;
};

/**
 * Computes the hash of a grant/revoke rule
 *
 * @param ruleStr string encoding of the rule
 * @param type type of the rule (grant or revoke)
 * @returns hash of the rule
 */
export function computeRuleHash(
  ruleStr: string,
  type: "grant" | "revoke"
): string {
  const hash = Hash.init();
  const encoding = hash.subEncoding();
  const [selfSignRequired, atoms] = RuleParser.parseTo256BitVector(ruleStr);

  atoms.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));

  encoding.addBytes32(RULE_HASH);
  encoding.subHash().addString(type.toLowerCase());
  encoding.addBoolean(selfSignRequired);
  encoding.subHash().subEncoding().addBytes32Array(atoms);

  return hash.encode();
}

/**
 * Converts a bigint to a 256-bit hex string (left-padded with zeroes if necessary)
 * The String is prefixed with the prefix "0x" to indicate that is meant to be a hex-string
 *
 * @param n number to convert
 * @returns corresponding hex string
 */
export function toPrefixed256BitHexString(n: bigint): string {
  let str = n.toString(16);
  if (str.length < 64) {
    str = "0".repeat(64 - str.length) + str;
  }
  return `0x${str}`;
}
