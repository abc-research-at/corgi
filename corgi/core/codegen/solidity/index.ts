/**
 * Copyright ABC Research GmbH 2023. All rights reserved
 *
 * Index file for the solidity-code-generation.
 */

import { OrgChartDef, CompilerConfig } from "../../common";
import { FileWriter } from "../../fs";
import { CompilerBackend } from "../CorgiCompiler";
import { DynOrgChartCompiler } from "./DynOrgChartCompiler";
import { StdOrgChartCompiler } from "./StdOrgChartCompiler";

/**
 * This class is a little wrapper around the actual solidity
 * compiler backend for standard orgcharts. Don't mind me ;-)
 */
export class StdOrgChartCompilerWrapper implements CompilerBackend {
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
  public compile(
    def: OrgChartDef,
    config: CompilerConfig,
    writer: FileWriter
  ): Promise<void> {
    const compiler = new StdOrgChartCompiler(def, config, writer);
    return compiler.compile();
  }
}

/**
 * This class is a little wrapper around the actual solidity
 * compiler backend for dynamic orgcharts. Don't mind me ;-)
 */
export class DynOrgChartCompilerWrapper implements CompilerBackend {
  /**
   * Compile a given preprocessed org-chart definition
   * of a dynamic orgchart using the solidity backend
   *
   * @param def preprocessed definition of the orgchart
   * @param config compiler options
   * @param writer defines where the result should be written to
   * @returns a promise resolving when everything was successfully
   *          written
   */
  public compile(
    def: OrgChartDef,
    config: CompilerConfig,
    writer: FileWriter
  ): Promise<void> {
    const compiler = new DynOrgChartCompiler(def, config, writer);
    return compiler.compile();
  }
}
