# `orglang`

Specifying nested structures as an OrgChart can become quite complex and cluttered.
For that reason, we have introduced a very simple language for defining OrgCharts that is more
suitable for our needs, namely `orglang`. By design, `orglang` allows for a more local view
of the graph which, we hope, makes it easier to specify larger hierarchies.
In this section, you will find a quick overview of the language.

In this repository, all `orglang` files use the extension `.org`. This is, however, not necessary and just
used as a convention inside this repository. The first line in each `orglang` file has to define the contract itself.
Of course, comment lines are not counted. The syntax for defining a contract looks like this:

```
                                           ┌───────┐
                                      ┌────► "std" ├────┐
                                      │    └───────┘    │
    ┌─────────────┐   ┌────────┐   ┌──┴──┐           ┌──▼──┐
○──►│ ":contract" ├─|─► <name> ├───► "(" │           │ ")" ├──►◉
    └─────────────┘   └────────┘   └──┬──┘           └──▲──┘
                                      │    ┌───────┐    │
                                      └────► "dyn" ├────┘
                                           └───────┘
```

> **_NOTE:_** If an edge in the syntax-diagram is interrupted by a `|`, then there must
> be at least one space between the tokens. For any other edge, you can use as many spaces
> as you may like.

So for example:

```
:contract SimpleOrgChart(dyn)
```

The `<name>` specifies the name of the Solidity contract. In the parentheses directly after the name,
you can specify the type of OrgChart you want to create: `std` stands for "standard" and will create a
fixed OrgChart whose structure cannot be changed after deployment. If you need to add and remove roles
after deployment, you have to choose a dynamic OrgChart indicated by writing `dyn` (which stands for "dynamic")
instead of `std`.

After defining the contract, the order of the remaining lines does not really matter. In particular, you can
also use roles before you have defined them. For readability, however, we suggest defining roles before using them.

To add a role to the OrgChart, the following syntax is used:

```
                       ┌──────────────────────────────────────────────┐
    ┌─────────┐   ┌────┴───┐   ┌─────┐    ┌──────────┐    ┌─────┐     ▼
○──►│ ":role" ├─|─► <name> ├───► "(" ├─┬──► <parent> ├─┬──► ")" ├────►◉
    └─────────┘   └────────┘   └─────┘ │  └──────────┘ │  └─────┘
                                       │    ┌─────┐    │
                                       └────┤ "," ◄────┘
                                            └─────┘
```

Inside the parentheses one can specify the senior roles of the newly created role. For example,
if we want to say, that role `AB` is a junior role of role `A` and `B`, we would write:

```
:role AB(A,B)
```

Note that the list of parentheses is optional. Hence, this is also valid:

```
:role root
```

This line simply states that there is role `root` which is not a junior role of any other role.
Since all OrgCharts are required to form a DAG, there must be at least one role of that form.

Next we want to define revoke and grant rules for our roles. For that purpose, the following
syntax is used:

```
          ┌────────────────────────────────────────┐
    ┌─────┴────┐    ┌─────┐     ┌──────────┐    ┌──▼───┐       ┌────────┐
○──►│ Q-Role 1 ├────► "," ├─────► Q-Role i ├─┬──► "->" ├───────► <role> ├───►◉
    └──────────┘    └──▲──┘     └──────────┘ │  └──┬───┘       └───▲────┘
                       │                     │     │               │
                       │                     │     │               │
                       │                     │     │    ┌─────┐    │
                       └─────────────────────┘     └────► "-" ├────┘
                                                        └─────┘
```

where `Q-Role` is a placeholder for the syntax diagram:

```
             ┌────────────────────────────────────────────┐
        ┌────┴───┐   ┌─────┐   ┌───────┐      ┌─────┐     ▼
○──┬────► <rol>  ├───► "(" ├───► <num> ├──────► ")" ├────►◉
   |    └───▲────┘   └─────┘   └───┬───┘      └──▲──┘
   |        |                      |             |
┌──▼──┐     |                   ┌──▼──┐          |
| "!" ├─────┘                   | "%" ├──────────┘
└─────┘                         └─────┘
```

So for example, to say that one signer of role `A` and two signers of role `B` are required to grant the role `AB`,
we would write

```
A(1), B(2) -> AB
```

In case that only one signer is needed, specifying the number of signers is optional. Hence, the following
line has the same meaning:

```
A, B(2) -> AB
```

The `-` sign shown in the syntax diagram above is used to indicate revoke-rules. So for example, to denote that a signer
of role `A` is needed to revoke role `AB`, one can write:

```
A -> -AB
```

For each OrgChart, there is a special role called `self`, which cannot be granted nor revoked, but can be used to indicate
that the nominee herself has to sign the grant or revoke request (although a self-sign for revoking might not make sense).
For example, if we want that a signer of role `A`, a signer of role `B` and the nominee herself has to sign to grant role `AB`,
we would write:

```
A, b, self -> AB
```

> **_NOTE:_** Syntactically, it would be fine to write `self(2)`. Since every signer can only sign once, this does not make sense.
> CORGI will therefore just ignore the number and read it as `self`.

In some cases, we may want to avoid role-inheritance, i.e., we don't want senior roles
to sign for junior roles. For that purpose we can make a role-requirement strict:

```
!A, !B -> AB
```

This means that only users with role `A` and `B` can grant role `AB`. So even if there would
be a role senior to `A` and `B`, users of that role would not be allowed to grant role `AB`.

Another feature is the relative rule: Assume you want that not one `A`, but at least `50%` of the users
having role `A` sign the request. In that case, we would write:

```
A(50%), B -> AB
```

Be aware that only users directly assigned to `A` are counted for the number of users of role `A`. Hence,
if we have for example two users of role `A`, then a role senior to role `A` can sign this request. Since
one signature is enough for fulfilling `50%` of `A`, we have the case that no user that is directly assigned to
`A` has signed the request and still it would be valid.

For that reason, we strongly recommend to use relative rules only in combination with strict rules:

```
!A(50%), B -> AB
```

In this case, seniors of `A` wouldn't be allowed to sign as `A`.

Finally, to get things started, an initial assignment of roles to users is necessary, since every grant role needs at least one role
on the right-hand-side of the rule. For that, `orglang` allows to specify an initial assignment, using the following syntax:

```
                           ┌──────┐  ┌───────┐
                      ┌──|─► "0x" ├►►► <hex> ├──┐
                      │    └──────┘  └───────┘  |
   ┌─────────┐   ┌────┴───┐                     |
○──│ ":init" ├─|─► <role> │                     ├──►◉
   └─────────┘   └────┬───┘                     |
                      |    ┌─────┐  ┌───────┐   |
                      └──|─► "$" ├►►► <par> ├───┘
                           └─────┘  └───────┘
```

> **_NOTE:_** In the syntax diagram, the `►►►` edge denotes that there **must not** be a space
> between the two tokens connected by that edge. Also, the placeholder `<hex>` should represent a
> hexadecimal number.

So for example, if we want to initially assign the role `root` to the user with the address `0xABCD...`,
we would write

```
:init root 0xABCD...
```

However, in some cases, the address of the user may not be known upon smart contract creation and will only
be fixed on deployment. In this case, one can use the constructor parameters of the contract to define the initial
user-role-assignment. In `orglang` this is written as follows:

```
:init root $par1
```

This states, that the role `root` should be initially assigned to the user that is passed by the constructor parameter
named `par1`. If we let `Corgi` generate this contract, the source code of the contract would look something like this:

```solidity
contract Test is BitVectorOrgChart {
	constructor(address par1) BitVectorOrgChart() {
		// Granting roles root to par1
		user2Roles[a1] = par1;
	}
     ...
}
```

To allow changes in dynamic OrgCharts, we can also specify so-called admin rules.
They specify which kind of roles have to sign in order to add or remove a role.
The syntax of admin-rules is defined as follows:

```
                               ┌───────────────────────────────────────┐
    ┌───────────────┐    ┌─────┴────┐    ┌─────┐    ┌──────────┐       ▼
○──►│ ":admin-rule" ├─|──► Q-Role 1 ├────► "," ├────► Q-Role i ├─┬────►◉
    └───────────────┘    └──────────┘    └──▲──┘    └──────────┘ │
                                            │                    │
                                            │                    │
                                            │                    │
                                            └────────────────────┘
```

With this, we conclude our quick introduction to `orglang`. For more examples, check out the example contracts
located in the [resource folder](../res/).
