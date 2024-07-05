/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains some utils for writing to a file.
 */
import { FileHandle, open } from "fs/promises";
import { Maybe } from "@utils";
import { PathLike } from "fs";

type WriteResult = {
  bytesWritten: number;
  buffer: Buffer;
};

/**
 * Class providing some utilities for writing to files.
 * Roughly speaking the `FileWriter` takes care of the asynchronous
 * file writes by building up a chain of promises. This way one can
 * write to files without using asynchronous function. The `FileWriter`
 * builds up a combined-promise that takes care of the order of the writes
 * and that can be awaited at the very end to ensure that everything was written
 * to the file
 */
export class FileWriter {
  private pChain: Promise<WriteResult>;

  /**
   * Constructor. Note that this is an private constructor. To create
   * a new instance of `FileWriter` use the static function `open`
   *
   * @param handle handle of the output-file
   * @param prefix prefix function; will be applied on each written string
   * @param parent parent file-writer; if specified all calls will be
   *               delegated to the parent (after applying the file writer's prefix)
   */
  private constructor(
    private readonly handle: FileHandle,
    private readonly prefix: (txt: string) => string,
    private readonly parent: Maybe<FileWriter>
  ) {
    this.pChain = Promise.resolve({ bytesWritten: 0, buffer: Buffer.alloc(0) });
  }

  /**
   * Static function for instantiating
   *
   * @param path location of the output-file
   * @returns Promise resolving to an instance of `FileWriter`
   */
  public static async open(path: PathLike): Promise<FileWriter> {
    const handle = await open(path, "w");
    return new FileWriter(handle, (t) => t, Maybe.Nothing());
  }

  /**
   * Appends a new line to the output-file. The same as `append` but ensures that
   * the appended line ends with a newline. If the passed line ends with a newline
   * no further newline will be added.
   *
   * @param line line to append
   * @param prefixed add prefix at the beginning
   */
  public appendLine(line: string, prefixed = true): void {
    line = line.endsWith("\n") ? line : `${line}\n`;
    this.append(line, prefixed);
  }

  /**
   * Appends the passed text to the output-file.
   *
   * @param text text to append
   * @param prefixed add prefix at the beginning
   */
  public append(text: string, prefixed = true): void {
    this.parent.ifPresent((p) =>
      p.appendInternal(text, prefixed ? this.prefix : (s) => s)
    );
    this.parent.ifNotPresent(() =>
      this.appendInternal(text, prefixed ? this.prefix : (s) => s)
    );
  }

  /**
   * Internal function for appending text to the output-file.
   * This function will add a new promise to the promise-chain.
   *
   * @param text text to append
   * @param prefix the prefix function that should be applied to the text
   */
  private appendInternal(text: string, prefix: (txt: string) => string): void {
    this.pChain = this.pChain.then((oldRes) => {
      return this.handle
        .write(Buffer.from(prefix(`${text}`), "utf-8"))
        .then((newRes) => ({
          bytesWritten: oldRes.bytesWritten + newRes.bytesWritten,
          buffer: Buffer.concat([oldRes.buffer, newRes.buffer]),
        }));
    });
  }

  /**
   * Reads in a file and appends its content to the writer's output-file.
   *
   * @param path location of the file that should be read
   */
  public appendFromFile(path: PathLike): void {
    if (this.parent.isPresent())
      this.parent.val().appendFromFileInternal(path, this.prefix);
    this.appendFromFileInternal(path, this.prefix);
  }

  /**
   * Internal function for reading in a file and appending its content to
   * the writer's output file.
   *
   * @param path location of the file that should be read in
   * @param prefix prefix that should be applied on the file's content
   */
  private appendFromFileInternal(
    path: PathLike,
    prefix: (txt: string) => string
  ) {
    this.pChain = this.pChain.then(async (oldRes) => {
      const fHandle = await open(path, "r");
      const content = (await fHandle.readFile()).toString("utf-8");
      await fHandle.close();

      const buffer = Buffer.from(
        content
          .split("\n")
          .map((l) => prefix(l))
          .join("\n"),
        "utf-8"
      );
      const newRes = await this.handle.write(buffer);
      return {
        bytesWritten: oldRes.bytesWritten + newRes.bytesWritten,
        buffer: Buffer.concat([oldRes.buffer, newRes.buffer]),
      };
    });
  }

  /**
   * Return the head of the promise chain. The returned
   * promise will resolve after all content was written
   * to the output-file.
   *
   * @returns the head of the promise chain
   */
  public writePromise(): Promise<WriteResult> {
    if (this.parent.isPresent()) return this.parent.val().writePromise();
    return this.pChain;
  }

  /**
   * Closes the file handle. Note that this function will not wait until
   * all content was written to the file. This has to be taken care of
   * manually by awaiting the promise returned by the function `writePromise()`.
   *
   * @returns promise resolving after the file was closed.
   */
  public close(): Promise<void> {
    if (this.parent.isPresent()) return this.parent.val().close();
    return this.handle.close();
  }

  /**
   * Creates a new file-writer with a given prefix. The
   * newly created file-writer will use this file-writer as
   * parent. Hence, all calls to the newly created file-writer
   * will be delegated to this file-writer. Anyhow, before delegation
   * the call, the newly created file-writer will apply the specified prefix.
   *
   * @param prefix prefix function that will be applied to every appended text
   * @returns newly created file-writer
   */
  public newPrefixContext(prefix: string): FileWriter {
    const preFn = (txt: string) => prefix + this.prefix(txt);
    const writer = new FileWriter(
      this.handle,
      preFn,
      Maybe.of(this.parent.isPresent() ? this.parent.val() : this)
    );
    writer.pChain = this.pChain;
    return writer;
  }

  /**
   * Getter for the parent file-writer
   *
   * @returns the parent file-writer if present; otherwise `this` will
   *          be returned.
   */
  public outerScope(): FileWriter {
    if (this.parent.isPresent()) return this.parent.val().outerScope();
    return this;
  }
}
