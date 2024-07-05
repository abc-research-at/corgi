/**
 * Copyright ABC Research GmbH 2023. All rights reserved
 *
 * This file contains the schema of the compiler's
 * config as well as the default settings.
 */

/**
 * Schema of the compiler's config
 */
export interface CompilerConfig {
  license: string;
  copyRight: string;
  solidityVersion: string;
  libDir: string;
  target: "solidity" | "dotlang";
}

export const DEFAULT_COMPILER_CONFIG = {
  license: "SPDX-License-Identifier: MIT",
  copyRight: "[NAME]",
  solidityVersion: "^0.8.7",
  libDir: "./",
  target: "solidity",
} as CompilerConfig;

export namespace CompilerConfig {
  /**
   * Function allowing creating a new config which inherits
   * its settings from the default configuration and overwrites
   * those values that are specified by the passed partial configuration.
   *
   * @param config partial configuration containing values that should be
   *               overwritten
   * @returns configuration
   */
  export function fromDefault(config: Partial<CompilerConfig>) {
    if (config.target) {
      if (config.target != "solidity" && config.target != "dotlang") {
        throw new Error(`Unknown target language "${config.target}"`);
      }
    }

    const completeConfig = { ...DEFAULT_COMPILER_CONFIG };
    Object.getOwnPropertyNames(config).forEach((val) => {
      if ((config as any)[val]) {
        (completeConfig as any)[val] = (config as any)[val];
      }
    });

    return completeConfig;
  }
}
