/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the CLI of CORGI.
 */

import { Command } from "commander";
import { CompilerConfig } from "@core/common";
import { CorgiCompiler } from "@core/codegen";
import { exit } from "process";
import fs from "fs";
import path from "path";

const program = new Command();

/**
 * Internal helper function for checking if a file is readable.
 *
 * @param path location of the file
 * @returns Promise resolving to `true` if readable and `false` otherwise
 */
function isFileReadable(path: string | fs.PathLike): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    fs.access(path, fs.constants.R_OK, (err) => {
      if (err) return resolve(false);
      return resolve(true);
    });
  });
}

/**
 * Creates a nice little greeting. Nobody like impolite programs...
 *
 * @returns greeting message
 */
function getGreeting(): string {
  const data = fs.readFileSync(path.join(__dirname, "../res/welcome.txt"));
  return data.toString();
}

/**
 * Interface describing all options of the CLI
 */
interface Options {
  out?: string;
  target?: "solidity" | "dotlang";
  license?: string;
  copyright?: string;
  solidityLibPath: string;
}

program.name("CORGI").version("2.0.0 - pembroke").description(getGreeting());

program
  .command("compile")
  .argument("<file>", "org file")
  .option("-o, --out <out>", "output file")
  .option("-l, --license <license>", "specify the license of your contract")
  .option(
    "-c, --copyright <copyright>",
    "specify the copyright holder of your contracts"
  )
  .option(
    "-t, --target <target>",
    "choose between solidity or dotlang",
    "solidity"
  )
  .option("--solidity-lib-path <lib>", "library path", "./")

  .action(async (file: string, opts: Options) => {
    if (!(await isFileReadable(file))) {
      throw new Error(`Cannot open file "${file}"`);
    }
    const out = getOutputPath(opts);

    try {
      const compiler = new CorgiCompiler(file, out);
      const config = CompilerConfig.fromDefault({
        libDir: opts.solidityLibPath,
        target: opts.target,
        license: opts.license,
        copyRight: opts.copyright,
      });
      await compiler.compile(config);
    } catch (err) {
      if (typeof err == "object" && err != null) {
        console.error(`Fatal error: ${err.toString()}`);
      } else {
        console.error("Fatal error: Unknown");
      }
      exit(1);
    }
  });

/**
 * Returns the output path by considering
 * the output options.
 *
 * @param opts command line options
 * @returns output path
 */
function getOutputPath(opts: Options): string {
  const ext = opts.target === "solidity" ? "sol" : "dot";
  const out = opts.out ?? `./OrgChart.${ext}`;

  if (out.endsWith(`.${ext}`)) {
    return out;
  }
  return `${out}.${ext}`;
}

/**
 * Run CORGI with the specified arguments.
 * Useful for debugging
 *
 * @param argv array of passed arguments
 */
export default async function runArgs(argv: string[] = []): Promise<void> {
  if (argv.length == 0) argv = process.argv;
  program.parse(argv);
}
