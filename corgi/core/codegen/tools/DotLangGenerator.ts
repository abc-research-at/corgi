/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains utils for dot-lang files.
 */
import { FileWriter } from "../../fs";
import { WriterContext } from "./WriterContext";

/**
 * Helper-class for writing dot-lang files
 */
export class DotLangGenerator extends WriterContext {
  /**
   * Appends a new graph to the file
   * @param name name of the graph
   * @returns a graph context of the newly created graph
   */
  public graph(name: string | null): GraphContext {
    return new GraphContext(this.writer, name);
  }
}

/**
 * Helper-class for writing graphs inside an dot-lang file
 */
export class GraphContext extends WriterContext {
  private readonly innerContext: FileWriter;

  /**
   * Constructor
   *
   * @param writer location where to write to
   * @param name name of the graph
   */
  public constructor(writer: FileWriter, name: string | null = null) {
    super(writer);
    if (name) {
      writer.appendLine(`digraph ${name} {`);
    } else {
      writer.appendLine(`digraph {`);
    }
    this.innerContext = writer.newPrefixContext("\t");
    this.innerContext.appendLine("node [shape=record];");
  }

  /**
   * Adds a new node to the graph using the "record" shape
   *
   * @param nodeId id of the node
   * @returns node context
   */
  public addRecordNode(nodeId: string): NodeContext {
    return new NodeContext(this, this.innerContext, nodeId);
  }

  /**
   * Adds a new comment node to the graph
   *
   * @returns node context
   */
  public addCommentNode(): CommentNodeContext {
    return new CommentNodeContext(this, this.innerContext);
  }

  /**
   * Add a new edge to the graph
   *
   * @param nodeA tail-node of the edge
   * @param nodeB head-node of the edge
   * @returns the graph context
   */
  public addEdge(nodeA: string, nodeB: string): GraphContext {
    this.innerContext.appendLine(`"${nodeA}" -> "${nodeB}";`);
    return this;
  }

  /**
   * Close the graph context.
   * !DO NOT FORGET TO CALL! Otherwise, the generated
   * dot-lang file is invalid.
   */
  public end() {
    this.writer.appendLine("}");
  }
}

/**
 * Abstract helper-class providing some tools to
 * write labels more easily
 */
export abstract class LabelingContext extends WriterContext {
  private isAlreadyLabeled: boolean;

  /**
   * Constructor
   *
   * @param writer location where to write
   */
  public constructor(writer: FileWriter) {
    super(writer);
    this.isAlreadyLabeled = false;
  }

  /**
   * Add a "simple" label to the context, where "simple" means
   * a single-lined string.
   *
   * @param label
   * @returns this
   */
  public addSimpleLabel(label: string): this {
    this.writer.append(this.separator() + label.replace('"', '\\"'), false);
    this.isAlreadyLabeled = true;
    return this;
  }

  /**
   * Add a new label box to the content
   *
   * @returns context for the created label box
   */
  public addLabelBox(): NodeLabelBoxContext {
    this.writer.append(this.separator(), false);
    this.isAlreadyLabeled = true;
    return new NodeLabelBoxContext(this, this.writer);
  }

  /**
   * Add a new multi-line label to the context
   * @param labels list of "simple" labels, i.e. single-lined lables
   * @returns this
   */
  public addMultilineLabel(labels: string[]): this {
    this.writer.append(this.separator() + labels.join("\\l"), false);
    this.isAlreadyLabeled = true;
    return this;
  }

  /**
   * Little helper function taking care of separating possible multiple
   * labels
   *
   * @returns separator (either "|" or empty string)
   */
  private separator(): string {
    return this.isAlreadyLabeled ? "|" : "";
  }
}

/**
 * Helper-class for writing nodes in dot-lang
 */
export class NodeContext extends LabelingContext {
  /**
   * Constructor
   *
   * @param parent context of the graph for
   *               which the node should be defined
   * @param writer location where to write
   * @param nodeId id of the node
   */
  public constructor(
    private readonly parent: GraphContext,
    writer: FileWriter,
    nodeId: string
  ) {
    super(writer);
    this.writer.append(`"${nodeId}" [label="`);
    this.addSimpleLabel(nodeId);
  }

  /**
   * Close the graph context.
   * !DO NOT FORGET TO CALL! Otherwise, the generated
   * dot-lang file is invalid.
   *
   * @returns context of the enclosing graph
   */
  public end(): GraphContext {
    this.writer.appendLine('"];', false);
    return this.parent;
  }
}

/**
 * Helper-class for writing "comment" nodes
 */
export class CommentNodeContext extends LabelingContext {
  private static counter = 0;
  /**
   * Constructor
   *
   * @param parent context of the graph for
   *               which the node should be defined
   * @param writer location where to write
   */
  public constructor(
    private readonly parent: GraphContext,
    writer: FileWriter
  ) {
    super(writer);
    const nodeId = `comment-block-${CommentNodeContext.counter++}`;
    this.writer.append(
      `"--comment-block-${nodeId}---" [style="filled";fillcolor="burlywood1";label="`
    );
  }

  /**
   * Close the graph context.
   * !DO NOT FORGET TO CALL! Otherwise, the generated
   * dot-lang file is invalid.
   *
   * @returns context of the enclosing graph
   */
  public end(): GraphContext {
    this.writer.appendLine('"];', false);
    return this.parent;
  }
}

/**
 * Helper-class for writing label boxes
 */
export class NodeLabelBoxContext extends LabelingContext {
  /**
   * Constructor
   *
   * @param parent parent context
   * @param writer location where to write
   */
  public constructor(
    private readonly parent: LabelingContext,
    writer: FileWriter
  ) {
    super(writer);
    this.writer.append("{", false);
  }

  /**
   * Close the graph context.
   * !DO NOT FORGET TO CALL! Otherwise, the generated
   * dot-lang file is invalid.
   *
   * @returns the parent context
   */
  public end(): LabelingContext {
    this.writer.append("}", false);
    return this.parent;
  }
}
