/**
 * Copyright ABC Research GmbH 2023. All rights reserved.
 *
 * This file contains a compiler backend for translating
 * orgcharts to dot-lang files
 */

import { OrgChartAnalysis } from "@core/analysis";
import {
  CompilerConfig,
  OrgChartDef,
  RoleDef,
  RuleDef,
  RuleDefAtom,
} from "@core/common";
import { FileWriter } from "@core/fs";
import {
  DotLangGenerator,
  GraphContext,
  LabelingContext,
} from "../tools/DotLangGenerator";

/**
 * A compiler backend for dot-lang
 */
export class DotLangCompiler {
  protected generator: DotLangGenerator;
  protected readonly analysis: OrgChartAnalysis;

  /**
   * Constructor
   *
   * @param orgChartDef pre-processed definition of the orgchart
   * @param config compiler configuration
   * @param writer defines where to write the output of the compilation
   */
  public constructor(
    protected readonly orgChartDef: OrgChartDef,
    protected readonly config: CompilerConfig,
    writer: FileWriter
  ) {
    this.analysis = new OrgChartAnalysis(orgChartDef);
    this.generator = new DotLangGenerator(writer);
  }

  /**
   * Compile the orgchart passed to the constructor
   *
   * @returns Promise resolving when the compiled
   *          file was successfully written
   */
  public async compile(): Promise<void> {
    const ctx = this.generator.graph(this.orgChartDef.contractName);
    this.addAdminRules(ctx);
    this.orgChartDef.roleDef.forEach((role) => this.addNode(ctx, role));
    ctx.end();
    return this.generator.close();
  }

  /**
   * Add admin rules to a new comment node
   *
   * @param ctx context of the graph
   * @param adminRules list of admin rules
   */
  private addAdminRules(ctx: GraphContext) {
    if (this.orgChartDef.adminRules.length == 0) return;
    const comment = ctx.addCommentNode();
    comment.addSimpleLabel("admin-rules");
    this.addRules(comment, null, this.orgChartDef.adminRules);
    comment.end();
  }

  /**
   * Adding a new node to the orgchart where
   * a node represents a role
   *
   * @param ctx current graph-context
   * @param role definition of the corresponding role
   */
  private addNode(ctx: GraphContext, role: RoleDef) {
    const nodeCtx = ctx.addRecordNode(role.role);
    this.addRules(nodeCtx, role, [...role.grantRules, ...role.revokeRules]);
    nodeCtx.end();
    role.seniors.forEach((senior) => ctx.addEdge(senior, role.role));
  }

  /**
   * Adding rules to a node. These rules are added in the label
   * of the node.
   *
   * @param ctx current node-context
   * @param role role for which the rules should be defined
   *             null, if it is an admin rule
   * @param rules list of rules
   */
  private addRules(
    ctx: LabelingContext,
    role: RoleDef | null,
    rules: RuleDef[]
  ) {
    if (rules.length == 0) return;
    ctx
      .addLabelBox()
      .addMultilineLabel(
        rules.map((rule) => {
          if (role !== null) return DotLangCompiler.ruleToLabel(role, rule);
          return DotLangCompiler.ruleBodyToLabel(rule);
        })
      )
      .end();
  }

  /**
   * Little helper function that transforms a rule to
   * readable representation that can be used as label
   *
   * @param role role for which the rule is defined
   * @param ruleDef rule to convert
   * @returns string representation
   */
  private static ruleToLabel(role: RoleDef, ruleDef: RuleDef) {
    const rule = this.ruleBodyToLabel(ruleDef);
    return `${rule} -\\> ${ruleDef.type == "grant" ? "+" : "-"}${role.role}`;
  }

  /**
   * Little helper function that transforms a rule-body to
   * readable representation that can be used as label
   *
   * @param ruleDef rule to convert
   * @returns string representation
   */
  private static ruleBodyToLabel(ruleDef: RuleDef) {
    const rule = ruleDef.required
      .map((atom) => RuleDefAtom.toCommentString(atom))
      .join(", ");

    if (ruleDef.selfSignRequired) {
      return rule + ", self";
    }

    return rule;
  }
}
