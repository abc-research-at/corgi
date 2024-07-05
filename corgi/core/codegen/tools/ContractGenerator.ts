/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains utils for generating smart
 * contracts written in Solidity.
 */
import { FileWriter } from "@core/fs";
import { WriterContext } from "./WriterContext";

export type SolidityDataType =
  | "address"
  | "string"
  | "bytes32"
  | "uint256"
  | "void";
export type Modifier = "internal" | "public" | "override" | "view" | "pure";

export const memory = (dType: SolidityDataType) =>
  `${dType} memory` as SolidityDataType;
export const arr = (dType: SolidityDataType) =>
  `${dType}[]` as SolidityDataType;

export type Parameter = [string, SolidityDataType];
const parToString = (p: Parameter) => `${p[1]} ${p[0]}`;

/**
 * Helper function for assigning each modifier a
 * weight representing the order of the modifiers
 *
 * @param m modifier
 * @returns weight of the modifier
 */
function modWeight(m: Modifier): number {
  switch (m) {
    case "internal":
    case "public":
      return 0;
    case "view":
    case "pure":
      return 1;
    case "override":
      return 2;
  }
}

/**
 * Helper-class for writing smart contracts in Solidity
 */
export class ContractGenerator extends WriterContext {
  /**
   * Appends a new line declaring a new smart contract
   *
   * @param cName Name of the contract
   * @returns new generator allowing to specify additional
   *          properties for the class' header
   */
  public contract(cName: string): ContractClassHeaderContext {
    this.writer.append(`contract ${cName}`);
    return new ContractClassHeaderContext(this.writer);
  }
}

/**
 * Helper-class for writing smart contracts in Solidity
 */
export class ContractClassHeaderContext extends WriterContext {
  /**
   * Specifies a base class for the currently generated
   * smart contract
   *
   * @param baseClass name of the base class
   * @returns a writer-context for adding methods and a constructor
   *          to the contract
   */
  public isA(baseClass: string): ConstructorlessContractContext {
    this.writer.appendLine(` is ${baseClass} {`);
    return new ConstructorlessContractContext(
      this.writer.newPrefixContext("\t")
    );
  }

  /**
   * Adds a constructor to the contract
   *
   * @param pars list of parameters of the contract's constructor
   * @param baseConstruct in case the the contract is extending another
   *                      contract, this argument allows to specify the
   *                      call to the base class' constructor
   *
   * @returns a writer-context for specifying the content of the constructor
   */
  public construct(pars: Parameter[], baseConstruct = ""): MethodContext {
    const context = new ConstructorlessContractContext(
      this.writer.newPrefixContext("\t")
    );
    return context.construct(pars, baseConstruct);
  }

  /**
   * Adds a new method to the contract
   *
   * @param name name of the method to add
   * @param pars list of parameters of the method
   * @param modifiers modifier of the method
   * @param returns return type of the method
   * @returns a writer-context for specifying the content of the method
   */
  public method(
    name: string,
    pars: Parameter[],
    modifiers: Modifier[],
    returns: SolidityDataType = "void"
  ): MethodContext {
    const context = new ConstructorlessContractContext(
      this.writer.newPrefixContext("\t")
    );
    return context.method(name, pars, modifiers, returns);
  }
}

/**
 * Helper-class for writing smart contracts in Solidity
 */
export class ContractContext extends WriterContext {
  /**
   * Adds a new method to the contract
   *
   * @param name name of the method to add
   * @param pars list of parameters of the method
   * @param modifiers list of modifiers of the method
   * @param returns return type of the method
   * @returns a writer-context for specifying the content of the method
   */
  public method(
    name: string,
    pars: Parameter[],
    modifiers: Modifier[],
    returns: SolidityDataType = "void"
  ): MethodContext {
    this.writer.appendLine("");
    const sanMod = ContractContext.sanitizeModifiers(modifiers);
    const fHead = `function ${name}(${pars
      .map(parToString)
      .join(", ")}) ${sanMod.join(" ")}`;
    if (returns === "void") this.writer.appendLine(`${fHead} {`);
    else this.writer.appendLine(`${fHead} returns ${returns} {`);

    return new MethodContext(this.writer.newPrefixContext("\t"), this, () => {
      this.writer.appendLine("}");
    });
  }

  /**
   * Finalizes the smart contract
   */
  public end(): void {
    this.writer.outerScope().append("}");
  }

  /**
   * Internal function for sanitizing and validating a list
   * of method-modifiers. This ensures that no conflicting modifiers
   * are used (like for example "internal public") by throwing an
   * error. Furthermore, it ensures an order of the modifiers according
   * to the convention by reordering the modifiers.
   *
   * @param modifiers list of modifiers
   * @returns a correctly ordered list of modifiers according to the conventions
   */
  private static sanitizeModifiers(modifiers: Modifier[]): Modifier[] {
    modifiers.sort((m1, m2) => modWeight(m1) - modWeight(m2));
    const valid = modifiers.every((m, i) => {
      if (i == modifiers.length - 1) return true;
      return modWeight(m) != modWeight(modifiers[i + 1]);
    });

    if (!valid) {
      throw new Error(`Invalid modifier ${modifiers.join(" ")}`);
    }
    return modifiers;
  }
}

/**
 * Helper-class for writing smart contracts in Solidity
 */
export class ConstructorlessContractContext extends ContractContext {
  /**
   * Adds a constructor to the contract
   *
   * @param pars list of parameters of the contract's constructor
   * @param baseConstruct in case the the contract is extending another
   *                      contract, this argument allows to specify the
   *                      call to the base class' constructor
   *
   * @returns a writer-context for specifying the content of the constructor
   */
  public construct(pars: Parameter[], baseConstruct = ""): MethodContext {
    this.writer.appendLine(
      `constructor(${pars.map(parToString).join(", ")}) ${baseConstruct} {`
    );
    return new MethodContext(this.writer.newPrefixContext("\t"), this, (lc) => {
      if (lc === 0) this.writer.outerScope().appendLine("}");
      else this.writer.appendLine("}");
    });
  }
}

/**
 * Helper-class for writing smart contracts in Solidity
 */
export class MethodContext extends WriterContext {
  private lineCnt: number;

  /**
   * Constructor
   *
   * @param writer writer specifying the output file
   * @param parent parent context, i.e. context of the method's contract
   * @param retCallback callback function that will be called when the method
   *                    returns. The number of lines of the method will be passed
   *                    as the only argument of the callback.
   */
  public constructor(
    writer: FileWriter,
    private readonly parent: ContractContext,
    private readonly retCallback: (lc: number) => unknown
  ) {
    super(writer);
    this.lineCnt = 0;
  }

  /**
   * Appends a new line to the source file. It works the
   * same as `append` but it will ensure, that the line
   * ends with a newline. If the specified line already ends
   * with a newline, no further newline will be added.
   *
   * @param line line to add
   * @returns current writer context
   *
   * @remark This method is overwritten by the `MethodContext` in
   *         order to keep track of the line counter
   */
  public appendLine(line = ""): MethodContext {
    this.writer.appendLine(line);
    this.lineCnt++;
    return this;
  }

  /**
   * Adds an return statement. This will also close
   * the `MethodContext`. Note however, that calling this
   * function does not write a closing curly-brace to the
   * sourcefile. This should be handled in the callback that
   * is invoked upon calling this method.
   *
   * @param expr expression that should be returned
   * @returns the writer-context of the method's contract
   */
  public return(expr?: string): ContractContext {
    if (expr) this.writer.appendLine(`return ${expr}`);
    this.retCallback(this.lineCnt);
    return this.parent;
  }
}
