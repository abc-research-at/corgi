import { OrgChart } from "../../../typechain-types";
import { Request } from "./Request";
import { TestContext } from "./TestContext";

export abstract class TestBuildingStep<
  T extends TestContext<O>,
  O extends OrgChart,
  R extends Request
> {
  protected constructor(
    protected readonly ctx: T,
    protected readonly request: R
  ) {}
}
