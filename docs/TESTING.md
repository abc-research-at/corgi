# Testing

`Corgi` currently lacks a tool for testing an OrgChart before deployment. However, one
can use `Corgi`'s internal testing utilities to test if an OrgChart behaves as intended.
We therefore encourage you to have a look at the unit tests under `orgchart/test`.

This directory provides some utility functions for writing test cases.
So if you want to try something, simply create a new test-file there. After that you
can execute the tests running the following commands:

```sh
cd ./orgchart
npm ci
make # compile all the test org-charts
npx hardhat test
```

This will execute all the test cases. However, you can also filter them using the
command

```sh
npx hardhat test --grep "MyTestCases"
```

This will then only run those test cases that contain the string `"MyTestCases"` in their
name, which is the string specified as the first parameter of the `describe` method.

### Example – SimpleOrgChart

Here we show a short example of how to create an OrgChart and test it. First we have to define
our OrgChart. For that purpose, create the file `./orgchart/res/simple.org` and insert the
following lines of `orglang` code:

```
:contract SimpleOrgChart(std)

:role root
:role A(root)
:role B(root)
:role C(root)

root -> A
root -> B
root -> C

:init root $root
```

This file describes a standard OrgChart with four roles where one (the `root`) acts as kind of
administrative role that cannot be granted but can grant all the other roles.
To get things started, we want to define a `root` user using a constructor parameter, which is
indicated in the last line.

> For more details about `orglang`, check out [LANG.md](./docs/LANG.md)

Next, we want to create a new Solidity contract based on that definition file. For that we of
course use `Corgi`. Simply type the following command in your terminal:

```sh
corgi compile \
  -o <Project Folder>/orgchart/contracts/generated/SimpleOrgChart.sol \ # output file
  -n SimpleOrgChart \ # name of the contract
  --solidity-lib-path ../ \ # specify where the library contracts are located
  <Project Folder>/orgchart/res/simple.org # definition file
```

If there was no error, you should now see the file
`./orgchart/contracts/generated/SimpleOrgChart.sol`.
Assuming you are inside the `./orgchart` folder, you can build the file by typing

```
npx hardhat compile
```

This will generate the type-files for TypeScript. Finally, let us see if our OrgChart works
by writing a simple test. For that purpose, create the file `./orgchart/test/simple.ts` and
insert the following lines of code:

```typescript
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { BVOrgChartTestContext } from "./utils";

chai.use(chaiAsPromised);

describe("simple test", () => {
  let context: BVOrgChartTestContext;
  let signers: string[];

  before(async () => {
    signers = (await ethers.getSigners()).map((signer) => signer.address);
    context = await BVOrgChartTestContext.from("SimpleOrgChart", [
      ["root", signers[0]],
    ]);
  });

  it("must grant role A if root signs", async () => {
    // TODO: Implement test
  });
});
```

This will set up everything needed for testing. In particular, a new instance of
`SimpleOrgChart` is deployed and a user-address is passed to the contract's
constructor to be initially assigned to the role `root`.

Now let us check if granting role `A` works. To do so, we have to replace the `TODO` entry:

First, we will need a nominee. That is a user, that we want to assign the role to. Let us
take a new user that has no role yet. Our test utilities provide a rich set of useful tools that
take over most of the work. For finding a suitable nominee we can use the address book provided
by the test context:

```typescript
const nominee = context.addressBook.getUnassignedUsers()[0];
```

Now we are ready for building our test case. Again, we use our test utilities, which provide
some convenient functions for creating the test case. The whole test case looks like this:

```typescript
const test = context
  .testGranting("A")
  .to(nominee)
  .setSignersHavingRoles([["root", 1]])
  .usingRule("root")
  .setAssignmentManually([0])
  .send();
```

Let's go through that snippet line by line: In the first line, we simply say that
we want to test a grant-request. To be more specific, we want to test granting the role
`A` which is represented by the parameter.

In the second line, we specify the nominee, so the user to whom we want to assign the
role.

The third line specifies the signers. We could directly assign a specific signer by using the
function `setSigners(signers: Address[], selfSigned = false)`. However, we can also let the
test utilities handle that for us. With the third line, we specify that we need some signer that
has the role `root`. The test utilities will use the data from the address book to find a valid
set of signers.

The fourth line defines the rule that we want to use. This is necessary, as in general, there can be
multiple rules for granting role `A`. For specifying the rule, we can use the exact same syntax as for
the RHS (right-hand-side) of the rule specified in `orglang`. The test utility will translate them for us.

Now in general, given a set of signers and a set of required roles (according to the rule), it cannot be trivially
decided if a rule is fulfilled or not. This is because users can have multiple roles (either due to direct assignments
or role inheritance). Simply assigning each signer to the highest possible role she can sign also does not work in general,
as the DAO does not introduce a total but a partial order. In fact, it turns out, that the problem of checking if a rule
is fulfilled can be reduced to a MAX-FLOW-Problem. However, for running on-chain, this process is too costly. Instead,
we let an off-chain application define the assignment between signers and roles. Given a set of signers, a set of required rules
and an assignment from signers to roles, it is then trivial to check if a rule is fulfilled.

This is done by the fifth line: It says that the first signer should be signing for the first role of the rule.
More general, by writing `setAssignmentManually([n_0, ..., n_k])` we say that the `i`-th signer signs for the `n_i`-th role
of the rule. The order of roles in the rule is as specified by `usingRule`. Hence, if we write `A, B, C(2)` ("One A, one B and two Cs have to sign"),
then `0` refers to `A`, `1` to `B` and `2` to `C`. The order of the signers is according to the `setSigners` or `setSignersHavingRoles`.

Another option to set the assignment is using the `deduceAssignmentFromSigners`. This function can only be used if we have used
`setSignersHavingRole` as it assumes that the assignment is given by the set of signers. So, for example, if we write `setSignersHavingRole([[A, 2], [B,3]])`
it will assume that the assignment is `[0,0,1,1,1]` which means that the first two signers sign for the first role of the rule and the
remaining three will sign for the second role of the rule. As this would also be fine in our example, we could have used `deduceAssignmentFromSigners` too.

That's basically it. In the sixth and last line, we commit our request. Now that we have created
our request, we of course want to see if it was successful. For that purpose, once again, the
test utilities provide some useful tools, namely the `OrgChartTestBench` which is returned from calling
the `send` function as the last step of our test-case creation. We recommend having a look at the provided methods of
the test bench, but most likely you want to write something like this in the test case:

```typescript
await test.expectSuccess();
await test.expectHavingRole(nominee, "A");
await test.expectNotHavingRoles(nominee, ["B", "C"]);
```

> **_NOTE:_** Don't forget to await each of the checks as they
> are all asynchronous. Unfortunately, `mocha` cannot recognize
> that some promises are still pending. Hence, if you forget to await them
> it could happen that you miss some failed test cases.

> **_NOTE:_** After the test succeeds, the address book is automatically
> updated. Hence, for the following test cases, the address book knows that there
> is a user with role `A`. Although assuming an order in the unit tests is a bad practice,
> we have used it quite often in our test cases. (Sorry)

That's it. To execute the test, type the following command in the terminal (assuming your
working directory is `./orgchart`):

```
npx hardhat test --grep "simple"
```

You should now see something like this:

```
 simple test
    ✓ should grant role A if root signs
```
