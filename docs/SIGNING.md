# Hashing and Signing

In order to express their approval for a request (grant-, revoke-, admin-), signers
need to sign the request. For signing we use the Elliptic Curve Digital Signature Algorithm
(ECDSA) as supported by Ethereum through precompiled contracts. However, we do not
sign the structure of the request as it is but the hash of it. Hashing structured data
like our requests has to be done carefully. Otherwise, one could run into danger of introducing
hash collisions. In this section, we explain in detail how the signatures are computed for
requests.

## Basic Blocks

As we already mentioned, for signing we use `ECDSA`. For hashing our basic building block
is the `keccack256` hashing function as supported natively by the `EVM`.
Hence, we assume the existence of the following functions:

- `ecdsa(bytes32 hash, bytes key): bytes`: Where `hash` is the hash to sign and `key` is the key
  used by the signer. However, we consider signing in this section from the view of one signer.
  Hence, for simplicity we write `ecdsa(hash)` and just assume the function has access to the
  signer's key material. The function returns a signature of size `65` bytes. However,
  the returned signature is not of particular interest for us in this section.

- `keccack256(bytes data): bytes32`: Hashes `data` to a hash of size `32` bytes.
  Note that `keccack256` is also applicable for the type `string` in which case we assume implicit
  conversion from `string` to `bytes`. Hence, we can also write `keccack("hello")`.

- `concat(bytes32... data): bytes`: Concatenates all elements of `data` together. Note that
  this is actually realized by the function `encode` in Solidity. Since we will ensure that
  `concat` only concatenates elements with the size of exactly `32 bytes` each, the behavior of `encode`
  is basically that of an concatenation function.

## Replay-Attack-Prevention

The validity of signatures for requests must be timely restricted. For example, assume
Alice and Bob decide to revoke the role `P` from Eve because of some malicious behavior.
However, at some point Eve was granted the role `P`. If signatures are valid forever,
Eve could just look-up this grant-request and submit the approval again. If she is lucky,
all the signers still have the role necessary and she successfully gets back her role.

To avoid this, usually a nonce is added to the signed data – a strictly increasing number.
Signatures are then only valid if the used nonce is up-to-date. However, for the Contract
we did not want to keep track of a nonce for each user and using a global nonce is a bottleneck.

Hence we are using a different approach: Each signature refers to a base block. This is,
each signature contains the hash of a block that needs to be in the recent history when
the signature is validated. What is "recent" depends. For us, it is currently three blocks.

Hence, when Alice and Bob decide to sign a request, they first look up the current block-
hash and add it to the signature. This signature is then valid for the next three blocks.
When the signature is validated, the contract checks if the specified block-hash (which
cannot be manipulated as it was included in the signed hash) is in the recent history
of the current block. If not, the signature is rejected.

Other options would be to use the block-height instead. This would make it easier to plan
in advance. For example, if collecting signatures takes longer, one could specify a block-height
in the future. However, so far `Corgi` is using the block-hash.

## Cross-Domain Attacks

One other possible attack is to use the signature in another context. For example, assume
that an organization has two instances of an OrgChart running – the OrgChart called `Iron` and the
OrgChart `Gold`. The `Iron` OrgChart manages the access to a Wallet for a crypto asset `IronCoin`
while the `Gold` OrgChart manages the access for the asset `GoldCoin`. As the name suggests, `GoldCoin`
is much more valuable then `IronCoin`.

Now assume that in both OrgCharts, Alice and Bob are in charge of assigning the role
`CoinSpender`, which allows users having that role to spend coins from the company's wallet.
Alice and Bob decide to give Eve the role `CoinSpender` for the `Iron` OrgChart. However,
Eve could replay the approval also on the `Gold` OrgChart and therefore becomes a `CoinSpender`
for both OrgCharts.

A similar attack could be conducted when instances of an OrgChart are deployed on different
blockchains, although in our case this is most likely already prevented by the replay-attack-
protection. For the attack to work, both blockchains need to be the same. Anyhow, if we
would change at one point to block-height instead of block-hash this attack is more likely
to succeed.

For this reason, we add a so-called _domain-separator_ to each hash before signing it.
The domain-separator is a contract-instance-specific value that is computed by the contract
on deployment according to the [EIP-712](https://eips.ethereum.org/EIPS/eip-712):

```
domain_separator = let
    domainTypeHash = keccack256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)")
    nameHash = keccack256("OrgChart")
    versionHash = keccack256(1)

in keccack256(concat(domainTypeHash, nameHash, versionHash, CHAIN_ID, this, SALT))
```

The `CHAIN_ID` identifies the blockchain the contract it is deployed at. The field `this`
refers to the contract's address. The `SALT` is currently hard-coded in the OrgChart contract
but could in theory also be passed as an parameter.

Finally, we add the string `"\x19Ethereum Signed Message:\n32"` as an prefix to our hash.
This prefix is enforced by some libraries when signing. From a security perspective, however,
we do not see an additional protection by adding it (however, it also does not hurt... better
be safe than sorry).

Hence, for each hash, before we sign we first wrap it with the function `wrap(bytes32 hash):bytes32`
defined as follows:

```
wrap(hash) = let
    prefix="\x19Ethereum Signed Message:\n32"
    sep="\x19\x01"
    request=keccack256(concat(sep, domain_separator, hash))

in keccack256(concat(prefix, request))
```

## User-Management-Requests

As grant- and revoke-requests are quite similar, we can summarize them in a single request-
type: User-Management-Requests. These are composed of the following fields:

- `address nominee`: User who should be granted a role or revoked from a role
- `string action`: Action to perform; either `"grant"` or `"revoke"`
- `bytes32 roleId`: Identifier of the role
- `bytes32 baseBlockHash`: Hash of the base-block

First, we want to get rid of dynamically sized data as this could potentially be used for
creating hash collisions. Although the field `action` is in a way constantly sized, as
it is either the string `"grant"` or `"revoke"`, we hash it just in case.

Consequently, a user-management-request can be described by the following string:

```
UserManagementRequest(address nominee,bytes32 action,bytes32 role,bytes32 baseBlockHash)
```

We call this string the type descriptor `D_u` (where the `u` indicates that it is a
separator for the User-Management Request) and we include it in the hash of our request.
More precisely, it will be added as an prefix to the signed data.

To fit the explanation in [CORE.md](./CORE.md), we will call the function for
hashing user-management requests `h1`:

```
h1(nominee, action, roleId, baseBlockHash) = let
    typeHash = keccack256(D_u)
    actionHash = keccack256(action)

in wrap(keccack256(concat(typeHash, nominee, actionHash, roleId, baseBlockHash)))
```

## Admin-Requests

For admin-requests we have to differ between adding and removing roles. Since by adding a role
we have to craft a whole description of where to put the role and what rules are attached to
it, the hashing for adding works differently than for removing a role where it is enough to
specify the role's identifier.

### Adding a Role

For computing the hash of an add-role-request it is important to capture the whole request including
the role definition itself. A request for adding a role contains the following components:

- `bytes32 roleId`: An identifier for the role. This can be an arbitrary identifier. However, it is
  only allowed to use the first `30` lower significant bytes as described also
  [here](./ADVANCED.md#representation-of-rules). `Corgi` currently uses the first `30` bytes of
  the hash of the role's name.
- `uint256 roleFlag`: Part of the definition of the role; for more details have a look
  [here](./ADVANCED.md)
- `uint256 seniorFlags`: Part of the definition of the role; for more details have a look
  [here](./ADVANCED.md)
- `uint256 juniorFlags`: Part of the definition of the role; for more details have a look
  [here](./ADVANCED.md)
- `bytes32[] ruleHashes`: List of rule hashes. For more details, have a look
  [here](./ADVANCED.md#representation-of-rules)
- `bytes32 baseBlockHash`: Hash of the base-block

The list of hashes in `ruleHashes` will be hashed again to be representable as an single
`bytes32`. Hence, our type descriptor looks as follows:

```
AddRoleRequest(bytes32 roleId,bytes32 roleFlag,bytes32 seniorFlags,bytes32 juniorFlags,bytes32 hashOfRuleHashes,bytes32 baseBlockHash)
```

Similar to before, we will denote the type descriptor with `D_a`. Consequently, the function
`h2` as used in [CORE.md](./CORE.md) is defined as follows:

```
h2(roleId, roleFlag, seniorFlags, juniorFlags, ruleHashes, baseBlockHash) = let
    typeHash = keccack256(D_a)
    ruleCombinedHash = keccack256(concat(...ruleHashes))

in wrap(keccack256(concat(typeHash, roleId, roleFlag, seniorFlags, juniorFlags, ruleCombinedHash, baseBlockHash)))
```

### Removing a Role

Removing a role is way simpler, as we only have to specify the identifier of the role
we want to delete. Consequently, the request for removing a role contains only the following
few components:

- `bytes32 roleId`: An identifier for the role.
- `bytes32 baseBlockHash`: Hash of the base-block

The type descriptor which we will denote with `D_r` is then defined as

```
RemoveRoleRequest(bytes32 roleId,bytes32 baseBlockHash)
```

Finally, we define `h3` from [CORE.md](./CORE.md) as follows:

```
h3(role, baseBlockHash) = let
    typeHash = keccack256(D_r)

in wrap(keccack256(concat(typeHash, roleId, baseBlockHash)))
```

## Aggregating Signatures

As mentioned before on other places, users express their approval of an request by signing
it. Hence, when submitting an approval, it usually contains multiple signatures of users.
Obviously, each user is only allowed to sign once for a request.

To enforce this property without a check that is of quadratic complexity on-chain, the
signatures have to be sorted by the user's address in strictly increasing order. This
can be checked on-chain in linear time by iterating once over the signatures and recover
the signers' addresses.

**The OrgChart contract will not accept an approval with unordered signers!**
