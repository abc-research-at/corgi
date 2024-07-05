/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains some handy tools for generating more
 * complex and nested hashed structures
 */

import { ethers } from "ethers";

/**
 * This abstract class represents general processing step.
 * Instances of this class have to implement the "encodeValues"
 * function that returns the encoded value as a string and
 * the "getType" function which return the resulting (evm)
 * type of the encoding.
 */
abstract class NestedProcessingStep {
  protected readonly parent: NestedProcessingStep | null;
  private readonly values: any[];
  private readonly types: string[];

  /**
   * Constructor
   *
   * @param parent parent encoding step in case of nested structures
   */
  protected constructor(parent: NestedProcessingStep | null) {
    this.parent = parent;
    this.values = [];
    this.types = [];
  }

  /**
   * Adds a new hash-step. This step applies the
   * keccack hash-function on the input
   *
   * @returns the nested hash-step
   */
  public subHash(): NestedProcessingStep {
    const sub: NestedProcessingStep = new Hash(this);
    this.values.push(() => sub.encode());
    this.types.push(sub.getType());
    return sub;
  }

  /**
   * Adds a new encoding-step. This step applies the
   * solidity-encoding function on the input
   *
   * @returns the nested encoding-step
   */
  public subEncoding(): NestedProcessingStep {
    const sub: NestedProcessingStep = new Encoding(this);
    this.values.push(() => sub.encode());
    this.types.push(sub.getType());
    return sub;
  }

  /**
   * Adds a new packed-encoding-step. This step applies the
   * solidity-encodingPacked function on the input
   *
   *
   * @returns the nested packed-encoding-step
   */
  public subPackedEncoding(): NestedProcessingStep {
    const sub: NestedProcessingStep = new PackedEncoding(this);
    this.values.push(() => sub.encode());
    this.types.push(sub.getType());
    return sub;
  }

  /**
   * Closes the processing step. This has no effect on the
   * internal state of the step but is used as a helper function
   * to return the parent step. Helps when you want to write
   * the hashing method in one statement
   *
   * @returns the parent processing step
   */
  public close(): NestedProcessingStep {
    if (this.parent === null) {
      throw new Error(
        "Hash-Function Underflow: Reached the top level; cannot close"
      );
    }
    return this.parent!;
  }

  /**
   * Adds a string to the processing step
   *
   * @param str string to add
   * @returns this
   */
  public addString(str: string): NestedProcessingStep {
    this.values.push(str);
    this.types.push("string");
    return this;
  }

  /**
   * Adds a boolean to the processing step
   *
   * @param b boolean to add
   * @returns this
   */
  public addBoolean(b: boolean): NestedProcessingStep {
    this.values.push(b);
    this.types.push("bool");
    return this;
  }

  /**
   * Adds a 32-byte-sized word to the processing step
   *
   * @param byte32Str word encoded in hex
   * @returns this
   */
  public addBytes32(byte32Str: string): NestedProcessingStep {
    this.values.push(byte32Str);
    this.types.push("bytes32");
    return this;
  }

  /**
   * Adds an array of 32-byte-sized words to the processing step
   *
   * @param bytes32Str words encoded in hex
   * @returns this
   */
  public addBytes32Array(bytes32Str: string[]): NestedProcessingStep {
    this.values.push(bytes32Str);
    this.types.push("bytes32[]");
    return this;
  }

  /**
   * Adds an arbitrary long byte string to the processing step
   *
   * @param byteStr bytes string encoded in hex
   * @returns this
   */
  public addBytes(byteStr: string): NestedProcessingStep {
    this.values.push(byteStr);
    this.types.push("bytes");
    return this;
  }

  /**
   * Encodes the added input
   *
   * @returns encoded string-representation
   */
  public encode(): string {
    const processedValues = this.values.map((val: any) => {
      if (Array.isArray(val)) {
        return val;
      } else if (typeof val == "function") {
        return val();
      }
      return val;
    });

    return this.encodeValues(this.types, processedValues);
  }

  /**
   * Encodes the values passed to the step.
   *
   * @param processedTypes type description for each passed value
   * @param processedValues values
   * @returns encoded string-representation
   */
  protected abstract encodeValues(
    processedTypes: string[],
    processedValues: any[]
  ): string;

  /**
   * Returns the result type of the encoding
   *
   * @returns type description
   */
  protected abstract getType(): string;
}

/**
 * Little helper class implementing the Keccack
 * function as a NestedProcessingStep
 */
export class Hash extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @returns new instance of the hash-step
   */
  public static init(): Hash {
    return new Hash(null);
  }

  /**
   * Hashed the passed values. This function is meant to be called
   * by the abstract parent class
   *
   * @param processedTypes types of the values
   * @param processedValues values to hash
   * @returns hash value as hex-string
   */
  protected encodeValues(
    processedTypes: string[],
    processedValues: any[]
  ): string {
    return ethers.solidityPackedKeccak256(processedTypes, processedValues);
  }

  /**
   * Returns the type used for representing the hash value: bytes32
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes32";
  }
}

/**
 * Little helper class implementing the Encode
 * function as a NestedProcessingStep
 */
export class Encoding extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @returns new instance of the encoding-step
   */
  public static init(): Encoding {
    return new Encoding(null);
  }

  /**
   * Encodes the passed values. This function is meant to be called
   * by the abstract parent class
   *
   * @param processedTypes types of the values
   * @param processedValues values to encode
   * @returns encoded value as hex-string
   */
  protected encodeValues(
    processedTypes: string[],
    processedValues: any[]
  ): string {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      processedTypes,
      processedValues
    );
  }

  /**
   * Returns the type used for representing the encoded value: bytes
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes";
  }
}

/**
 * Little helper class implementing the PackedEncoding
 * function as a NestedProcessingStep
 */
export class PackedEncoding extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @returns new instance of the packed-encoding-step
   */
  public static init(): PackedEncoding {
    return new PackedEncoding(null);
  }

  /**
   * Encodes and packs the passed values. This function is meant to be called
   * by the abstract parent class
   *
   * @param processedTypes types of the values
   * @param processedValues values to encode
   * @returns encoded value as hex-string
   */
  protected encodeValues(
    processedTypes: string[],
    processedValues: any[]
  ): string {
    return ethers.solidityPacked(processedTypes, processedValues);
  }

  /**
   * Returns the type used for representing the encoded value: bytes
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes";
  }
}
