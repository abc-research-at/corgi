/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains utils for writing to files in a structured
 */
import { PathLike } from "fs";
import { FileWriter } from "../../fs";

/**
 * Class wrapping around an instance of `FileWriter` providing
 * some basic functions for generating source code written in
 * any language.
 */
export abstract class WriterContext {
  /**
   * Constructor
   *
   * @param writer writer specifying the output file
   */
  public constructor(protected readonly writer: FileWriter) {}

  /**
   * Add a new comment line to the generated source file
   *
   * @param comment comment to add
   * @returns current context
   */
  public comment(comment: string): WriterContext {
    this.writer.appendLine(`// ${comment}`);
    return this;
  }

  /**
   * Append text to the source file
   *
   * @param text text to append
   * @returns current writer context
   */
  public append(text: string): WriterContext {
    this.writer.append(text);
    return this;
  }

  /**
   * Appends a new line to the source file. It works the
   * same as `append` but it will ensure, that the line
   * ends with a newline. If the specified line already ends
   * with a newline, no further newline will be added.
   *
   * @param line line to add
   * @returns current writer context
   */
  public appendLine(line = ""): WriterContext {
    this.writer.appendLine(line);
    return this;
  }

  /**
   * Reads the whole file specified an adds its content
   * to the source file.
   *
   * @param path location of the file that should be added
   * @returns current writer context
   */
  public appendFromFile(path: PathLike): WriterContext {
    this.writer.appendFromFile(path);
    return this;
  }

  /**
   * Awaits until everything is written to the source file and
   * after that closes the writer.
   */
  public async close(): Promise<void> {
    await this.writer.writePromise();
    await this.writer.close();
  }
}
