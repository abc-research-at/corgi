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
  protected readonly debug: boolean;
  private readonly values: any[];
  private readonly types: string[];

  /**
   * Constructor
   *
   * @param parent parent encoding step in case of nested structures
   * @param debug set true to print out result of this step
   */
  protected constructor(
    parent: NestedProcessingStep | null,
    debug: boolean | undefined = undefined
  ) {
    this.parent = parent;
    this.values = [];
    this.types = [];

    if (parent == null) {
      this.debug = debug || false;
    } else {
      this.debug = debug === undefined ? this.parent.debug : debug;
    }
  }

  /**
   * Adds a new hash-step. This step applies the
   * keccack hash-function on the input
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns the nested hash-step
   */
  public subHash(debug: boolean | undefined = undefined): NestedProcessingStep {
    const sub: NestedProcessingStep = new Hash(this, debug);
    this.values.push(() => sub.encode());
    this.types.push(sub.getType());
    return sub;
  }

  /**
   * Adds a new encoding-step. This step applies the
   * solidity-encoding function on the input
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns the nested encoding-step
   */
  public subEncoding(
    debug: boolean | undefined = undefined
  ): NestedProcessingStep {
    const sub: NestedProcessingStep = new Encoding(this, debug);
    this.values.push(() => sub.encode());
    this.types.push(sub.getType());
    return sub;
  }

  /**
   * Adds a new packed-encoding-step. This step applies the
   * solidity-encodingPacked function on the input
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns the nested packed-encoding-step
   */
  public subPackedEncoding(
    debug: boolean | undefined = undefined
  ): NestedProcessingStep {
    const sub: NestedProcessingStep = new PackedEncoding(this, debug);
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

    const result = this.encodeValues(this.types, processedValues);
    this.logIfDebug(processedValues, result);
    return result;
  }

  /**
   * Prints information about the operation if debug flag
   * is true
   *
   * @param vals input values
   * @param result result of the encoding
   */
  private logIfDebug(vals: any[], result: string): void {
    if (!this.debug) return;
    console.log(`${this.opName()}(${vals.join(",")}) = ${result}`);
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

  /**
   * Returns the name of the encoding operation
   *
   * @returns name of op
   */
  protected abstract opName(): string;
}

/**
 * Little helper class implementing the Keccack
 * function as a NestedProcessingStep
 */
export class Hash extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns new instance of the hash-step
   */
  public static init(debug: boolean | undefined = undefined): Hash {
    return new Hash(null, debug);
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
    return ethers.utils.solidityKeccak256(processedTypes, processedValues);
  }

  /**
   * Returns the type used for representing the hash value: bytes32
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes32";
  }

  protected opName = () => "keccak256";
}

/**
 * Little helper class implementing the Encode
 * function as a NestedProcessingStep
 */
export class Encoding extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns new instance of the encoding-step
   */
  public static init(debug: boolean | undefined = undefined): Encoding {
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
    return ethers.utils.defaultAbiCoder.encode(processedTypes, processedValues);
  }

  /**
   * Returns the type used for representing the encoded value: bytes
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes";
  }

  protected opName = () => "encode";
}

/**
 * Little helper class implementing the PackedEncoding
 * function as a NestedProcessingStep
 */
export class PackedEncoding extends NestedProcessingStep {
  /**
   * Creation Function
   *
   * @param debug overwrite debug; if not specified, it is inherited from parent
   * @returns new instance of the packed-encoding-step
   */
  public static init(debug: boolean | undefined = undefined): PackedEncoding {
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
    return ethers.utils.solidityPack(processedTypes, processedValues);
  }

  /**
   * Returns the type used for representing the encoded value: bytes
   * @returns name of the type
   */
  protected getType(): string {
    return "bytes";
  }

  protected opName = () => "encodePacked";
}
