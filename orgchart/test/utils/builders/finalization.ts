import { OrgChart } from "../../../typechain-types";
import { Request } from "./Request";
import { TestBuildingStep } from "./TestBuildingStep";
import { TestContext } from "./TestContext";

/**
 * Final building-step for creating grant- or revoke-requests.
 * Out of the data specified by previous building-steps, this function
 * finally builds the actual request and offers a method to send it to
 * the test-instance.
 */
export class AbstractFinalizationStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request
> extends TestBuildingStep<T, O, R> {
  /**
   * Internal function for computing the approval
   *
   * @returns approval of the signers
   */
  protected async computeApproval() {
    const [baseBlockHash, sig] = await this.ctx.signRequest(this.request);

    return {
      sig,
      assignment: this.request.assignment,
      atoms: this.request.atoms,
      selfSignRequired: this.request.selfSigned,
      baseBlockHash: baseBlockHash,
    };
  }

  /**
   * Internal function for reordering the array of signers and the elements
   * of the rule. Atoms (elements of the rule) have to be ordered in ascending
   * order (with respect to their encoding). Signers also have to be ordered in
   * ascending order (with respect to their address). Hence, the signer-role
   * assignment has to be adapted.
   */
  protected reorder() {
    const signers2atoms = new Map<string, string>(
      this.request.signers
        .map((s, i) => {
          const aIdx = this.request.assignment[i];
          if (aIdx < this.request.atoms.length) {
            const atom = this.request.atoms[this.request.assignment[i]];
            return [s, atom] as [string, string];
          }
          return null;
        })
        .filter((x) => x !== null)
    );

    this.request.atoms.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1));
    const atom2Idx = new Map<string, number>(
      this.request.atoms.map((a, i) => [a, i])
    );

    this.request.assignment = this.request.signers.map((s) => {
      if (signers2atoms.has(s)) return atom2Idx.get(signers2atoms.get(s));
      return this.request.atoms.length;
    });

    const zipped = this.request.signers
      .map((s, i) => [s, this.request.assignment[i]] as [string, number])
      .sort(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1));

    this.request.signers = zipped.map(([s]) => s);
    this.request.assignment = zipped.map(([, i]) => i);
  }
}
