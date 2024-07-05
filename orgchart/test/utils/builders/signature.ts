import { OrgChart } from "../../../typechain-types/OrgChart";
import { RuleParser } from "../RuleParser";
import { Address, Role } from "../common";
import { TestBuildingStep } from "./TestBuildingStep";
import { Request } from "./Request";
import { TestContext } from "./TestContext";

abstract class SignatureBuildingStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request,
  S extends TestBuildingStep<T, O, R>
> extends TestBuildingStep<T, O, R> {
  public constructor(
    protected readonly ctx: T,
    protected readonly request: R,
    protected readonly next: (ctx: T, request: R) => S
  ) {
    super(ctx, request);
  }
}

export class SignatureBuilderInitStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request,
  S extends TestBuildingStep<T, O, R>
> extends SignatureBuildingStep<T, O, R, S> {
  /**
   * Setting the signers according to a role-requirement profile.
   * The function tries to find signers that fulfill the requirement
   * by using the information stored in the address book.
   *
   * @param roles required roles; array of tuples, where the first entry of the tuple
   *              contains the role and the second the number of signers for that role
   * @param selfSigned true if a self-sign should be added
   * @returns next building-step
   * @notice the order of the signer is as specified by the role-requirement; for example,
   *         if the role-requirement is `[["A", 2], ["B", 1]]` then the function will set the
   *         signers to the array `[sig1, sig2, sig3]` such that `sig1` and `sig2` have role A
   *         and `sig3` has role B.
   */
  public setSignersHavingRoles(
    roles: [Role, number][],
    selfSigned: boolean = false
  ): RuleSettingStep<T, O, R, S> {
    this.request.assignment = roles
      .map(([, n], i) => new Array(n).fill(i))
      .reduce((a, b) => [...a, ...b], []);

    const next = this.setSigners(
      this.ctx.addressBook.getUsersHavingRoles(roles),
      selfSigned
    );
    return next;
  }

  /**
   * Sets the signers of the request
   *
   * @param signers array of signers (address)
   * @param selfSigned true if a self-sign should be added
   * @returns next building-step
   */
  public setSigners(
    signers: Address[],
    selfSigned = false
  ): RuleSettingStep<T, O, R, S> {
    this.request.signers = signers;
    if (selfSigned && this.request.nominee) {
      this.request.signers.push(this.request.nominee);
    }
    return new RuleSettingStep<T, O, R, S>(this.ctx, this.request, this.next);
  }
}

/**
 * Building-Step for setting the rule that should be used for
 * the grant- or revoke-request
 */
export class RuleSettingStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request,
  S extends TestBuildingStep<T, O, R>
> extends SignatureBuildingStep<T, O, R, S> {
  /**
   * Sets the rule that should be used for the request
   * @param ruleStr rule expressed as org-lang rule; you must only use
   *                the LHS of the rule; for example, if the org-chart
   *                has a rule `A(2), B(1) -> C`, you would pass the
   *                string `A(2), B(1)` to this function in order to use
   *                the rule for the request
   * @returns next building-step
   */
  public usingRule(ruleStr: string): AssignmentSettingStep<T, O, R, S> {
    const [selfSignRequired, atoms] = RuleParser.parseTo256BitVector(ruleStr);

    this.request.selfSigned = selfSignRequired;
    this.request.atoms = atoms;
    return new AssignmentSettingStep<T, O, R, S>(
      this.ctx,
      this.request,
      this.next
    );
  }
}

/**
 * Building-Step for setting the signer-to-role assignment
 */
class AssignmentSettingStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request,
  S extends TestBuildingStep<T, O, R>
> extends SignatureBuildingStep<T, O, R, S> {
  /**
   * Deduce the role-to-signer assignment from the order of the signers.
   * For example, if the order of the signers is `[sig1, sig2, sig3]` and the
   * rule is `A(2), B(1)`, then `sig1` and `sig2` will be assigned to role `A`
   * and `sig2` will be assigned to role `B`
   *
   * @returns next building-step
   */
  public deduceAssignmentFromSigners(): S {
    if (!this.request.assignment) {
      throw new Error("Unable to set assignment automatically");
    }
    return this.setAssignmentManually(this.request.assignment);
  }

  /**
   * Sets signer-role-assignment according to passed assignment
   *
   * @param assignment array of role-indices; given a set of signers `[sig_1, ..., sig_n]` the
   *                   assignment `[r_1, ..., r_n]` means that signer `sig_1` signs for role with index `r_1`;
   *                   the role index is defined by the order of the role in the rule; for example
   *                   if we use the rule `A(2), B(1)`, role `A` has index `0` and role `B` has index `1`.
   *
   * @returns next building-step
   */
  public setAssignmentManually(assignment: number[]): S {
    this.request.assignment = assignment;
    if (this.request.selfSigned) {
      // last signer is the nominee
      this.request.assignment.push(this.request.atoms.length); // value does not really matter
    }
    return this.next(this.ctx, this.request);
  }
}
