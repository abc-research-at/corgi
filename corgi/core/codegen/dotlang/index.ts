/**
 * Copyright ABC Research GmbH 2023. All rights reserved
 *
 * Index file for the dotlang-code-generation.
 */

import { OrgChartDef, CompilerConfig } from "../../common";
import { FileWriter } from "../../fs";
import { CompilerBackend } from "../CorgiCompiler";
import { DotLangCompiler } from "./DotLangCompiler";

/**
 * This class is a little wrapper around the actual dot-lang
 * compiler backend. Don't mind me ;-)
 */
export class DotLangCompilerWrapper implements CompilerBackend {
  /**
   * Compile a given preprocessed org-chart definition
   * using the dot-lang backend
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
    const compiler = new DotLangCompiler(def, config, writer);
    return compiler.compile();
  }
}
