/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains multiple classes describing different
 * types of directed graphs which are needed for the analysis
 * of the orgchart.
 */

import { Maybe, MinHeap } from "@utils";

/**
 * Error class used to signal that a cycle
 * inside a graph was detected. This class is
 * only used internally to differ between run-time
 * errors that have to be propagated and cycle-detection
 * that lead to a negative result in the `isDAG` method
 * but are handled as an exception in the `getTopologicalOrder`
 * method that is used by `isDAG`.
 */
class CycleDetectedError extends Error {}

/**
 * This class represents an arbitrary directed
 * graph of fixed size. That is, after creation it is not
 * possible to add new nodes to the graph.
 */
export class DirectedGraph {
  /**
   * Getter for the graph's size
   * @returns size of the graph (= number of nodes)
   */
  public readonly size: () => number;

  /**
   * Adjacency list representing the graph's structure
   * with the intended meaning that if `adjLists[i] = [j,k,l]`
   * then there is an directed edge from not `i` to the nodes
   * `j`, `k` and `l`
   */
  protected adjLists: number[][];

  // Stores the in-degree for each node. That is, for each
  // node `i`, `inDegree[i]` stores the number of nodes `j` such
  // that `adjLists[j].findIndex(n => n == i) >= 0`
  protected inDegree: number[];

  /**
   * Constructor
   *
   * @param size size of the graph, i.e., the number of nodes.
   *             As the nodes are referred to by their index,
   *             the node indices are hence in the range `[0...(size-1)]`.
   * @param edgeList list of edges with the intended meaning that if
   *                 edgeList contains the tuple `[i,j]`, then there is a
   *                 directed edge from node `i` to node `j`.
   */
  public constructor(size: number, protected edgeList: [number, number][]) {
    this.size = () => size;
    this.adjLists = new Array(size).fill(0).map(() => []);

    edgeList.forEach(([source, sink]) => {
      this.validateNodeIndex(source);
      this.validateNodeIndex(sink);
      this.adjLists[source].push(sink);
    });

    this.inDegree = new Array(size).fill(0);
    this.adjLists.forEach((adjList) => {
      adjList.forEach((adjNode) => this.inDegree[adjNode]++);
    });
  }

  /**
   * Checks if the graph is acyclic (Directed Acyclic Graph or DAG for short).
   *
   * @remark A directed graph is acyclic if and only if it has a topological order.
   *         Hence, it is sufficient to check if a topological order exists
   * @returns true if the graph is acyclic, false otherwise
   */
  public isDAG(): boolean {
    return this.getTopologicalOrder().isPresent();
  }

  /**
   * Computes the topological order of a graph. In case the graph is cyclic
   * the graph does not have a topological order. This represented by returning
   * `Maybe.Nothing()`.
   *
   * @remark the array `t=[t_1, ... t_(size-1)]` is a topological order
   *         of the graph if for all nodes `i` and `j` s.t
   *         `adjLists[i].findIndex(n => n == j)` it holds that
   *         `t.findIndex(ti => ti == i) > t.findIndex(tj => tj == j)`
   * @returns array of all nodes sorted in a topological order and wrapped
   *          in the `Maybe` construct. If the topological order does not exist
   *          `Maybe.Nothing()` is returned.
   */
  public getTopologicalOrder(): Maybe<number[]> {
    const tempInDeg = [...this.inDegree];

    const heap = new MinHeap(this.size(), (idx) => tempInDeg[idx]);
    const order = [];

    while (heap.size() > 0) {
      const next = heap.pop();
      if (tempInDeg[next] !== 0) {
        return Maybe.Nothing();
      }
      order.push(next);
      this.adjLists[next].forEach((adjNode) => {
        tempInDeg[adjNode]--;
        heap.update(adjNode);
      });
    }
    return Maybe.of(order);
  }

  /**
   * Internal function for validating if the node (represented by its index)
   * is inside the allowed bounds (`[0...(size-1)]`)
   * @param node
   * @returns
   */
  protected validateNodeIndex(node: number) {
    if (node >= 0 || node < this.size()) {
      return;
    }
    throw new Error(`Error! Invalid node index ${node}`);
  }
}

/**
 * Function used for labeling a directed acyclic graph.
 *
 * @param node current node visited
 * @param adj adjacent nodes, i.e. all nodes of `adjLists[node]`
 * @param labelAdj labels of all the adjacent nodes
 */
export type Labeling<T> = (node: number, adj: number[], labelAdj: T[]) => T;

/**
 * Class representing a directed acyclic graph of fixed size.
 * That is, after creation it is not possible to add new nodes to
 * the graph
 */
export class DirectedAcyclicGraph extends DirectedGraph {
  public readonly topologicalOrder: number[];

  /**
   * Constructor
   *
   * @remark The constructor makes sure that the passed graph
   *         represented by the edge-list is indeed acyclic.
   *         If not, an error will be thrown
   * @param size size of the graph, i.e., the number of nodes.
   *             As the nodes are referred to by their index,
   *             the node indices are hence in the range `[0...(size-1)]`.
   * @param edgeList list of edges with the intended meaning that if
   *                 edgeList contains the tuple `[i,j]`, then there is a
   *                 directed edge from node `i` to node `j`.
   */
  public constructor(size: number, edgeList: [number, number][]) {
    super(size, edgeList);
    const order = this.getTopologicalOrder();

    if (!order.isPresent()) {
      throw new CycleDetectedError("Graph is not acyclic");
    }
    this.topologicalOrder = order.val();
  }

  /**
   * Apply a passed labeling from bottom-up, i.e., this function takes
   * a labelling function and calls it on every node while guaranteeing that
   * the for each node, the labelling function is first called on all its
   * child nodes first. Hence, one can assume that the `labelAdj` parameter
   * passed to the labelling function is always completely filled.
   *
   * @param labeling labelling function to apply
   * @returns `LabeledDirectedAcyclicGraph` containing a copy of the current
   *          graph and the generated labels.
   */
  public labelBottomUp<T>(
    labeling: Labeling<T>
  ): LabeledDirectedAcyclicGraph<T> {
    const labels = new Array<Maybe<T>>(this.size()).fill(Maybe.Nothing());

    this.topologicalOrder.forEach((node) => {
      if (this.inDegree[node] > 0) return;
      this.labelNodeBottomUp(node, labeling, labels);
    });
    return new LabeledDirectedAcyclicGraph(
      this.size(),
      this.edgeList,
      labels.map((l) => l.assertPresent())
    );
  }

  /**
   * Internal function for labelling the graph from bottom-up according to the passed
   * labelling and starting from a specific node, where bottom-up means that
   * each node is guaranteed to be labelled before all its child nodes.
   *
   * @param node node from which the labelling starts
   * @param labeling labelling function to apply
   * @param labels array of already assigned labels. The label of the i-th
   *               node is stored at the i-th entry in the array. It is assumed
   *               that entries for unlabeled nodes are assigned to `Maybe.Nothing()`
   *
   * @remark Note that the entries of the `labels` array will change upon calling this
   *         function
   */
  private labelNodeBottomUp<T>(
    node: number,
    labeling: Labeling<T>,
    labels: Maybe<T>[]
  ) {
    this.adjLists[node].forEach((adjNode) => {
      if (!labels[adjNode].isPresent()) {
        this.labelNodeBottomUp(adjNode, labeling, labels);
      }
    });

    const labelAdj = this.adjLists[node].map((adjNode) =>
      labels[adjNode].assertPresent()
    );
    labels[node] = Maybe.of(labeling(node, this.adjLists[node], labelAdj));
  }
}

/**
 * Class representing a labelled directed acyclic graph of fixed size,
 * where "labelled" means that each node is associated with a value (label)
 * of arbitrary type and "fixed sized" refers to the fact, that after creation
 * it is not possible to add a new node to the graph.
 */
export class LabeledDirectedAcyclicGraph<T> extends DirectedAcyclicGraph {
  public constructor(
    size: number,
    edgeList: [number, number][],
    private labeling: T[]
  ) {
    super(size, edgeList);
    if (!this.isDAG()) {
      throw new Error("Graph is not acyclic");
    }
  }

  public getLabel(node: number): T {
    this.validateNodeIndex(node);
    return this.labeling[node];
  }
}
