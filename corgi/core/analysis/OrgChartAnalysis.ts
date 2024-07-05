/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains an analysis tool for orgcharts
 * that extracts certain properties of the orgchart
 * needed for generating the contract files
 */

import {
  DirectedAcyclicGraph,
  LabeledDirectedAcyclicGraph,
} from "./DirectedGraph";
import { OrgChartDef, RuleDefAtom } from "@core/common";
import { SafeMap } from "@utils/SafeMap";
import { ethers } from "ethers";

/**
 * Class implementing the analysis-tool for orgcharts.
 * The class serves as both, the analysis-tool as well as
 * the results of the analysis.
 */
export class OrgChartAnalysis {
  public static readonly FLAG_STRICT_ROLE = 0x1;
  public static readonly FLAG_RELATIVE_QTY = 0x2;

  private readonly base: DirectedAcyclicGraph;
  private readonly role2NodeId: SafeMap<string, number>;
  private readonly nodeId2Role: SafeMap<number, string>;
  private readonly flagGraph: LabeledDirectedAcyclicGraph<bigint>;
  private readonly maskGraph: LabeledDirectedAcyclicGraph<bigint>;
  private readonly juniorMaskGraph: LabeledDirectedAcyclicGraph<bigint>;

  public role2Id: SafeMap<string, string>;
  public role2Flag: SafeMap<string, bigint>;
  public role2Mask: SafeMap<string, bigint>;
  public role2JuniorMask: SafeMap<string, bigint>;
  public topologicalRoleOrder: string[] = [];
  public freeRoleFlags: bigint;

  /**
   * Constructor
   *
   * All of the analysis takes place here, as all the executed analysis
   * are rather simple.
   *
   * @param orgChart orgchart that should be analyzed
   */
  public constructor(private readonly orgChart: OrgChartDef) {
    [this.base, this.role2NodeId, this.nodeId2Role] =
      OrgChartAnalysis.fromOrgChart(orgChart);
    this.flagGraph = this.base.labelBottomUp((n) => BigInt(1) << BigInt(n));
    this.maskGraph = this.flagGraph.labelBottomUp<bigint>(
      (node, _, adjLabels) =>
        this.flagGraph.getLabel(node) |
        adjLabels.reduce((a, b) => a | b, BigInt(0))
    );
    this.juniorMaskGraph = this.flagGraph.labelBottomUp<bigint>((_, adj) =>
      adj
        .map((a) => this.flagGraph.getLabel(a))
        .reduce((a, b) => a | b, BigInt(0))
    );

    this.role2Id = new SafeMap(
      this.orgChart.roles.map((r) => [r, OrgChartAnalysis.computeRoleId(r)])
    );
    this.role2Flag = new SafeMap(
      this.orgChart.roles.map((r) => [
        r,
        this.flagGraph.getLabel(this.role2NodeId.assertExist(r)),
      ])
    );
    this.role2Mask = new SafeMap(
      this.orgChart.roles.map((r) => [
        r,
        this.maskGraph.getLabel(this.role2NodeId.assertExist(r)),
      ])
    );
    this.role2JuniorMask = new SafeMap(
      this.orgChart.roles.map((r) => [
        r,
        this.juniorMaskGraph.getLabel(this.role2NodeId.assertExist(r)),
      ])
    );
    this.topologicalRoleOrder = this.base.topologicalOrder.map((nodeId) =>
      this.nodeId2Role.assertExist(nodeId)
    );
    this.freeRoleFlags = this.getFreeRoleFlags();
  }

  /**
   * Internal function for calculating the bitmask representing
   * the available role-flags needed for the smart contract. That is,
   * a bit-vector of size 256 bit, where each bit is set to 1 except
   * all the entries of the vector that are already taken by roles
   * defined in the orgchart-definition.
   *
   * @returns bitmask representing the available role-flags
   */
  private getFreeRoleFlags(): bigint {
    let freeFlags = (BigInt(1) << BigInt(256)) - BigInt(1);
    this.role2NodeId.forEach(
      (nodeId) => (freeFlags &= ~this.flagGraph.getLabel(nodeId))
    );
    return freeFlags;
  }

  /**
   * Builds a directed acyclic graph (DAG) based on a passed orgchart that
   * represents the orgchart's structure, i.e., for each role `r`
   * in the orgchart, there is a vertex `v` in the graph and if
   * `r1` is a senior role of `r2` then there is an edge
   * `e=(v1,v2)`, where `v1` and `v2` are the corresponding
   * vertices of role `r1` and `r2` respectively.
   *
   * @param orgchart orgchart serving as blueprint for the DAG
   * @returns a tuple of size three where the first entry contains the graph, the second entry
   *          contains a mapping from the role (name of the role) to the vertex id
   *          in the graph and the third entry contains the reverse mapping.
   */
  private static fromOrgChart(
    orgchart: OrgChartDef
  ): [DirectedAcyclicGraph, SafeMap<string, number>, SafeMap<number, string>] {
    const size = orgchart.roles.length;
    const role2NodeId = new SafeMap<string, number>(
      orgchart.roles.map((v, i) => [v, i])
    );
    const nodeId2role = new SafeMap<number, string>(
      orgchart.roles.map((v, i) => [i, v])
    );

    const edgeList = orgchart.roleDef
      .map((def) => {
        if (!role2NodeId.has(def.role))
          throw new Error(`Unknown role "${def.role}"`);
        const edges = def.seniors.map((p) => {
          if (!role2NodeId.has(p)) throw new Error(`Unknown role "${p}"`);
          return [
            role2NodeId.assertExist(p),
            role2NodeId.assertExist(def.role),
          ] as [number, number];
        });
        return edges;
      })
      .reduce((a, b) => [...a, ...b], []);

    orgchart.initialization.forEach((init) => {
      if (!role2NodeId.has(init.role)) {
        throw new Error(`Unknown role "${init.role}"`);
      }
    });

    return [new DirectedAcyclicGraph(size, edgeList), role2NodeId, nodeId2role];
  }

  /**
   * Computes the id of the role given its name. The id is computed
   * by taking the first 30 bytes of the keccack256-hash of the role name.
   * The reason for taking only 30 bytes is the encoding of the rules, where
   * the remaining two bytes are used to carry additional information.
   *
   * @param role
   * @returns id o f the role
   */
  public static computeRoleId(role: string): string {
    const hash = ethers.solidityPackedKeccak256(["string"], [role]);
    const roleId = BigInt(hash) >> BigInt(16);
    return OrgChartAnalysis.toPrefixed256BitHexString(roleId);
  }

  /**
   * Encodes one atom of a rule to fit into 256 bytes.
   * The first 30 bytes is reserved for the role id, the 31st byte
   * holds the required quantity and the 32nd byte holds an sequence
   * of flags describing further properties.
   *
   * @param atom atom to encode
   * @returns bigint of size 256 bit
   */
  public encodeRuleAtom(atom: RuleDefAtom): string {
    const id = BigInt(this.role2Id.assertExist(atom.role));
    const flags =
      (atom.isStrict ? OrgChartAnalysis.FLAG_STRICT_ROLE : 0) |
      (atom.isRelative ? OrgChartAnalysis.FLAG_RELATIVE_QTY : 0);

    const enc =
      id | (BigInt(atom.n) << BigInt(240)) | (BigInt(flags) << BigInt(248));
    return OrgChartAnalysis.toPrefixed256BitHexString(enc);
  }

  /**
   * Converts a bigint to a 256-bit hex string (left-padded with zeroes if necessary)
   * The String is prefixed with the prefix "0x" to indicate that is meant to be a hex-string
   *
   * @param n number to convert
   * @returns corresponding hex string
   */
  public static toPrefixed256BitHexString(n: bigint): string {
    let str = n.toString(16);
    if (str.length < 64) {
      str = "0".repeat(64 - str.length) + str;
    }
    return `0x${str}`;
  }
}
