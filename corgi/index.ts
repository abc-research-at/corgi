/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains the program's entry point.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(<any>process)[Symbol.for("ts-node.register.instance")]) {
  // running in native node.js
  // eslint-disable-next-line global-require
  require("module-alias/register");
}
import { exit } from "process";
import runArgs from "./cli";

const main = async () => {
  try {
    runArgs();
  } catch (err: unknown) {
    if (typeof err == "object" && err != null) {
      console.error(`Fatal error: ${err.toString()}`);
    } else {
      console.error("Fatal error");
    }
    exit(1);
  }
};

main();
