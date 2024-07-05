/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024 ABC Research GmbH
 *
 * This file contains the functionality for enabling MultiSig in our OrgChart.
 * In partiuclar, the MultiSignable takes care of a proper hasing of the
 * structured data of the grant/revoke requests in order to avoid attacks like
 * for example replay-attacks. For this purpose, that contract implements the
 * EIP-712. For more details, have a look at the documentation in docs/SIGNING.md
 */

pragma solidity ^0.8.7;

abstract contract MultiSignable {
    // Structure for representing a signature
    struct Signature {
        uint8 v; // last part of the signature
        bytes32 r; // first 32 bytes of the signature
        bytes32 s; // second group of 32 bytes of the signature
    }

    /**
     * Returns the set of signers given a set of signatures.
     * The Signatures have to be valid ECDSA signatures.
     *
     * @param sig signatures of all signers
     * @param nominee address of the nominee; needed for determining if self-signed
     * @return result tuple where the first one is a flag, indicating if the nominee has signed
     *                and the second is an array of signer addresses
     * @notice It is required that |sigV|=|sigR|=|sigS|; will revert if not
     * @notice The signatures have to be ordered in ascending order of the corresponding
     *         signer's address. This makes it easy to verify that no signer signs
     *         more than once.
     */
    function getSigners(
        Signature[] memory sig,
        address nominee,
        bytes32 targetHash
    ) internal pure returns (bool, address[] memory) {
        // Zero-Address; not obtainable but used as a lower bound for checking
        // the sorting
        address lastAdd = address(0);
        address[] memory signers = new address[](sig.length);
        bool selfSigned = false;

        for (uint256 i = 0; i < sig.length; i++) {
            address recovered = ecrecover(
                targetHash,
                sig[i].v,
                sig[i].r,
                sig[i].s
            );
            require(
                recovered > lastAdd,
                "Signers need to be sorted in ascending order"
            );
            lastAdd = recovered;
            signers[i] = recovered;
            if (recovered == nominee) {
                selfSigned = true;
            }
        }
        return (selfSigned, signers);
    }
}
