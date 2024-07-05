/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the corig compiler (frontend).
 */
import {
  CompilerConfig,
  DEFAULT_COMPILER_CONFIG,
  OrgChartDef,
} from "@core/common";
import { FileWriter } from "../fs";
import { DotLangCompiler, DynOrgChartCompiler, StdOrgChartCompiler } from ".";
import { PathLike, readFile } from "fs";
import { promisify } from "util";
import { Parser } from "@core/parser";

/**
 * Definition of an arbitrary compiler backend
 * for orgcharts
 */
export interface CompilerBackend {
  /**
   * Compile a given preprocessed org-chart definition
   * of a standard orgchart using the solidity backend
   *
   * @param def preprocessed definition of the orgchart
   * @param config compiler options
   * @param writer defines where the result should be written to
   * @returns a promise resolving when everything was successfully
   *          written
   */
  compile(
    def: OrgChartDef,
    config: CompilerConfig,
    writer: FileWriter
  ): Promise<void>;
}

/**
 * Corgi Compiler (frontend). Allows compiling orgcharts
 * to either solidity contracts or dot-lang files
 */
export class CorgiCompiler {
  /**
   * Constructor
   *
   * @param srcFile source file
   * @param out output directory
   */
  public constructor(
    private readonly srcFile: PathLike,
    private readonly out: PathLike
  ) {}

  /**
   * Compile the source file passed in the constructor
   *
   * @param config compiler configuration
   *
   * @returns A promise resolving when everything was written
   *          to the output file
   */
  public async compile(config = DEFAULT_COMPILER_CONFIG): Promise<void> {
    const orgChart = await this.load();
    let backend = CorgiCompiler.getBackend(orgChart, config);

    const writer = await FileWriter.open(this.out);
    return backend.compile(orgChart, config, writer);
  }

  /**
   * Helper function returning the parsed content of the source file
   *
   * @returns parsed orgchart definition
   */
  private async load(): Promise<OrgChartDef> {
    const content = await promisify(readFile)(this.srcFile);
    const parser = new Parser(
      content.toString("utf-8"),
      this.srcFile.toString()
    );
    return parser.parse();
  }

  /**
   * Given an orgchart definition and the compiler option this
   * function returns the according backend which should be used
   *
   * @param orgChart orgchart to compile
   * @param config compiler configuration
   * @returns compiler backend
   */
  private static getBackend(
    orgChart: OrgChartDef,
    config: CompilerConfig
  ): CompilerBackend {
    switch (config.target) {
      case "solidity":
        if (orgChart.orgChartType == "dyn") return new DynOrgChartCompiler();
        else return new StdOrgChartCompiler();
      case "dotlang":
        return new DotLangCompiler();
    }
  }
}
