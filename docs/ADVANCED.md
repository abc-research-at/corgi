# Advanced Concepts

In this file, we want to explain the basic concepts in this project. In particular,
we are focusing here on the way we represent the OrgChart on-chain as well as the problem
of assigning approvers of a request to the required rules.

## Bit Vector Labeling

One problem we have encountered first early versions of `Corgi` is that by representing the
OrgChart naively as a DAG (using data structures representing the nodes and edges),
gas costs increase tremendously with the size of the OrgChart.

One way of optimizing is to think of more efficient ways of storing the OrgChart on-chain.
However, one could also ask if it is necessary to store the complete OrgChart on-chain. If we
look at the operation we have to perform on the graph, we see that it is actually enough to know the
relation among the roles.

For example, we are not interested in the fact that there is a directed path `A->B->C`, but only
in the fact that _C_ is a junior role of _A_ and _B_. We can achieve that by choosing an appropriate
labeling algorithm and then only store the node's label.

For that purpose we have introduced a labeling schema based on bit vectors. The idea is quite simple:
Let $G=(V,E)$ be a DAG representing an OrgChart and let

$$f: E \mapsto \set{i \in \mathbb{N} \mid 0 \leq i < |V|}$$

be a bijection representing an ordering of the vertices. Then we first assign to each vertex $v \in V$ the
label

$$b(v) = (2^{f(n)})_2,$$

where $(x)_2$ represents the binary representation of the number $x$.

For each vertex $v \in V$, we then define the final label $\ell(v)$ as follows:
$$\ell(v) = b(v) \lor \bigvee_{(v,x) \in E} \ell(v),$$
where $\lor$ denotes the bitwise-or.

For example consider the following DAG:

```
                                    ┌─────────┐
                                    │ l=11111 │
                              ┌─────┤ b=10000 ├────┐
                              │     └─────────┘    │
                              │                    │
                         ┌────▼────┐         ┌─────▼───┐
                         │ l=00111 │         │ l=01010 │
                    ┌────┤ b=00100 ├───┐  ┌──┤ b=01000 │
                    │    └─────────┘   │  │  └─────────┘
                    │                  │  │
               ┌────▼────┐          ┌──▼──▼───┐
               │ l=00001 │          │ l=00010 │
               │ b=00001 │          │ b=00010 │
               └─────────┘          └─────────┘
```

Here, we can see a graph of five nodes. Hence, by construction, each label has to be five bits long.
It is easy to see how we can deduce hierarchy information based on the label $\ell(n)$. For example, clearly
the root node can be identified as the one having all bits in its label set to 1. More generally, we can
formulate the following:

> Given a DAG $G=(V,E)$ and its corresponding labeling
> $$\ell: V \mapsto \{(i) \in \mathbb{N} \mid 1 \leq n \leq 2^{|V|}-1\}$$
> There is a directed path from $v_1 \in V$ to $v_2 \in V$ if and only if
> $$\ell(v_1) \land \ell(v_2) = \ell(v_2)$$
> where $\land$ is a bit-wise and.

Note that a directed path from one vertex to another means (translated to the OrgChart) that the
corresponding role is a senior role of the other. For the structure itself and assuming that we
do not want to change the structure after deployment, it is sufficient to store the labels for our purpose.
However, CORGI also supports so-called "dynamic OrgCharts", where roles can be added and removed. Here, some
further housekeeping information is needed.

For the user-role-assignment it gets a bit more tricky. In the first versions of CORGI we simply assigned
each user to a bitmask, which is just the combination (using bitwise-or) of all roles' labels assigned to the user. This works
perfectly fine as long as you do not revoke roles. As an example where one can see the problem of that solution, consider
the following org-chart:

```
┌─────┐
│  A  ├───┐
└──┬──┘   │
   │   ┌──▼──┐
   │   │  B  │
   │   └──┬──┘
┌──▼──┐   │
│  C  ◄───┘
└─────┘
```

Now for simplicity, let us assume that the labels are bit-vectors of size 3. Hence, we have the following labeling:

```
A = 111
B = 011
C = 001
```

In the straightforward solution, each user's role assignment is initially set to `0`. Let us now grant
role `C` to user Bob, after which we would have something like this:

```
user2Role[bob] = 001
```

After some time, we feel that Bob needs a promotion. So now we also grant role `A` to him.
We recompute the user-role assignment by combining the label from `A` and that from `C`:

```
user2Role[bob]  = 001 | 111 = 111
```

Now what happens if someone wants to revoke role `B` from Bob? Bob was never assigned to role `B` but
inherits its permission as Bob is assigned to `A`. However, given only the bitmask, we can not distinguish
between roles directly assigned to Bob and roles that were just inherited. Furthermore, consider what happens
if we remove role `B`:

```
user2Role[bob] = 111 & (~011) = 111 & 100 = 100
```

Now we get a bitmask that does not correspond to any of our roles. In particular, we have now also revoked role `C` from
Bob. This unintuitive behavior is of course not what we want to have for our OrgChart.

We will not go into details here of how we have solved this problem and instead refer to the
[BitVectorOrgChart contract](../orgchart/contracts/BitVectorOrgChart.sol) as well as the
[DynamicBitVectorOrgChart contract](../orgchart/contracts/DynamicBitVectorOrgChart.sol).
However, in the following, you'll find some explanatory notes:

Previously, we described the construction of the two labels $b(v)$ and $\ell(v)$. Now instead of
only storing $\ell(v)$ for each node, we now also store $b(v)$ and use the $b(v)$ to build up the bitmasks
representing a user's role. Applied to our previous example, this would look like this:

```
b[A] = 100
b[B] = 010
b[C] = 001

l[A] = b[A] | b[B] | b[C] = 111
l[B] = b[B] | b[C] = 011
l[C] = b[C] = 001
```

If we now assign the roles `A` and `C` to Bob, the bitmask representing Bob's roles would look like
this:

```
user2Role[bob] = b[A] | b[C] = 101
```

In case we want to revoke role `B` from Bob, we immediately see that Bob was never directly assigned to role `B`.
One problem of that representation is, that we now lose the structural information, i.e., we can no longer see
that Bob inherits the permissions from role `B` since he is assigned to role `A` which is a senior of `B`. However,
given the new user-role-assignment `user2Role[bob]` it is easy to compute the old one on-chain. A naive implementation would
look like this:

```
rolesOfBob = 0
for each bit in user2Role[bob] {
     role = getRoleHavingBLabel(bit) // reverse-mapping of b[role]
     rolesOfBob[bob] |= l[A]
}
return rolesOfBob
```

As the size of the label is constant and there is no complex computation inside the loop, the
whole algorithm also has constant runtime complexity. Furthermore, using a binary-search-like approach,
the loop can be optimized in most of the cases to find the set bits.

## Representation of Rules

Rules for granting and revoking as well as admin-rules are not stored directly on-chain.
Instead, only their hash is secured on-chain to avoid manipulation. The actual rule has
to be provided together with the approval that uses it. This is due to the fact that
`calldata` is cheaper than `storage`.

For this, we need to introduce a lightweight representation for the rule. We will represent
a rule, as a list of rule-atoms, where a rule-atom is a quantified role (with optional a
strict-modifier) as described also [here](./CORE.md#rules).

We represent a rule-atom in a `32 bytes` where we dedicate the first two most significant
bytes for the quantifiers and modifiers of the role and the remaining `30 bytes` for the
role identifier. In `Corgi` the role identifier is computed by hashing the name of the role
and taking the first `30 bytes` of it.

The most significant byte is used for representing numbers from `0` to `255`. This corresponds
to the quantification of the role. For example, if a rule required `5` users with role `A` to
sign, the first byte would have the value `0x5`.

The second most significant byte is reserved for modifiers. Currently only two modifiers are needed.
Let `m` be the second most significant byte, then the least significant bit of `m` represents the
strict-modifier, i.e. if it is set to `1`, it means, the rule-atom is strict.

The second least significant bit of `m` represents a flag that indicates wether the number should
be interpreted as relative or not. For example if the most significant byte is set to `0xa` and
`m`'s second least significant bit is set to `1`, the rule-atom is read as `10%` of a certain role.

### Example 1: 3 Users of Role `A`:

```
| QUANTITY  | MODIFIER  | ROLE ID |
-----------------------------------
| 0000 0011 | 0000 0000 | ....... |
```

### Example 2: 3 Users of Role `!A` (strictly `A`)

```
| QUANTITY  | MODIFIER  | ROLE ID |
-----------------------------------
| 0000 0011 | 0000 0001 | ....... |
```

### Example 2: 50% of Role `!A` (strictly `A`)

```
| QUANTITY  | MODIFIER  | ROLE ID |
-----------------------------------
| 0011 0010 | 0000 0011 | ....... |
```

The rule can then be represented by a list of rule-atoms (`bytes32[]`) and an additional flag
(`bool`) that indicates if the rule requires a signature from the nominee themselves. The
flag is `false` for admin-requests (where there is no nominee).

For hashing the rule, we apply a similar strategy as for hashing the requests before signing them
(as described [here](./SIGNING.md)). In particular, we first introduce the type descriptor
for the rules denoted by `D_rule`:

```
Rule(bytes32 type,bool selfSigned,bytes32 ruleHash)
```

The field `type` specifies which kind of rule it is (either the hash of `grant`, `revoke`
or `admin`). As mentioned, `selfSigned` indicates whether the rule requires a signature
of the nominee. Finally, `ruleHash` is the hash of the rule-atoms combined together.

Consequently, the rule-hash-function `h_rule` is defined as follows (by using the building
block as defined [here](./SIGNING.md)):

```
h_rule(string action, bool selfSigned, bytes32[] atoms) = let
     typeHash = keccack256(D_rule)
     actionHash = keccack256(action)
     ruleHash = keccack256(concat(atoms))

in keccack256(concat(typeHash, actionHash, selfSigned, ruleHash))
```

## Flow Network

When sending an approval to the contract, we do assume that the assignment
from signers to the roles that they sign for is provided. However, so far
we have not discussed how an off-chain signing tool could compute such an assignment
which is actually non-trivial in the presence of permission inheritance.

This is due to the fact that we are considering arbitrary DAGs as OrgCharts. If we
define an order over the nodes of the DAG in the natural way, namely
$$v_2 \leq v_1 \iff (v_1, v_2) \in E \lor v_1 = v_2,$$
we see that in general $<$ is only a partial order.

This can lead to strange situations. Let us consider the following simple OrgChart:

```
                                ┌─────────┐
                                │  Boss   │
                                └────┬────┘
                                     │
                                     │
                                ┌────▼────┐
                                │ Co-Boss │
                                └─────────┘
```

Furthermore, let us assume that it needs a boss and a co-boss to grant the role Boss.
Now let Alice be a boss and Bob be a co-boss. Charlie does not have a role yet, but wants to
become a boss. Both Alice and Bob approve this request, so they sign the request and send their
signatures to the smart contract. The smart contract extracts the identities of Alice and Bob
(i.e., their public keys) and looks up their roles. Also, the smart contract knows that in order to
grant the role "boss", it needs an approval from a boss and a co-boss. The question is now, how do we
assign the signers to the required roles of the rule?

Of course, if we assign Alice to the role "boss" and Bob to the role "co-boss", this works just fine. However, because of inheritance,
Alice could also fulfill the role "co-boss" which would make the approval invalid as Bob cannot fulfill the role "boss".
In this example, it is easy to recognize the right assignment of roles. This, however, can get quite complicated
if the rules become bigger.

> **_NOTE:_** One common pitfall is to say "Well, just assign a signer to the highest role possible".
> However, note that two roles are not necessarily comparable.

The Problem of assigning signers to roles can be reduced to a [Max-Flow-Problem](https://en.wikipedia.org/wiki/Maximum_flow_problem), which
then can be solved by algorithms, like for example [Ford-Fulkerson](https://en.wikipedia.org/wiki/Ford%E2%80%93Fulkerson_algorithm).
We now quickly describe the reduction. For explanation of the Ford-Fulkerson algorithm or the Max-Flow-Problem in general, we refer
to the linked Wikipedia articles.

### Problem

A grant rule $G$ is a set $G \subseteq \mathbb{N} \times R$ where $R$ is the set of roles. Given a grant
role $r$ and a set of signers $S$ and a role assignment $a: S \mapsto 2^R$, does there exists a function
$f: S \mapsto R$ such that for each $(r, n) \in G$
$$|\{s \in S \mid f(s) =r\}| = n$$
and for each $s \in S$ it holds that $f(s) \leq a(s)$ (where the order $\leq$ over the roles is defined the natural
way)?

### Reduction

Given the above describe problem instance, construct the Flow-Network
$$F=(V,E,c)$$
where $c: E \mapsto \mathbb{N}$ is the capacity of each edge. The set $V$ of vertices
is defined as follows:
$$V = \{\textit{sink}, \textit{source}\} \cup S \cup \{r \mid (r,n) \in G\},$$
Then we compute the following edge sets:
$$E_1 = \{(\textit{source}, s) \mid s \in S\}$$
such that for each $e \in E_1$ we define $c(e) = 1$,
$$E_2 = \{(s, r) | s \in S, r \in a(s) \cap \{r \mid (r,n) \in G\}\},$$
such that for each $e \in E_2$ we define $c(e) = 1$ and finally
$$E_3 = \{(r, \textit{sink}) \mid (r, n) \in G\},$$
such that for each $e = (r, n) \in E_3$ we define $c(e) = n$.

> **_Reduction-Claim:_** There exists a function $f$ as described above if and only if
> the max-flow of the corresponding Max-Flow-Network equals
> $$\sum_{(r,n) \in G}n.$$

As it is a tradition in every math lecture, the proof of this claim will be left as an exercise ;-).
