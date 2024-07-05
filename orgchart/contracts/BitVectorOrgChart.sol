/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024 ABC Research GmbH
 *
 * This file contains an implementation of a bit vector labeled org chart using
 * mulitsig. For more details we refer to /docs/ADVANCED.md and /docs/SIGNING.md
 */
pragma solidity ^0.8.7;

import "./OrgChart.sol";

abstract contract BitVectorOrgChart is OrgChart {
    // = keccak256("UserManagementRequest(address nominee,bytes32 action,bytes32 role,bytes32 baseBlockHash)")
    bytes32 public constant USER_MGT_REQ_HASH =
        0x4188b8d190b775104aa586eb6c5d6b815d12bb4e103b72d0d4937b62c85c778e;

    // = keccak256("Rule(bytes32 type,bool selfSigned,bytes32 ruleHash)")
    bytes32 public constant RULE_HASH =
        0x64bddff132fc1c7cb4776ef381143d78d0f2f6873b824fa04d6c83665ba25c38;

    // flag used to indicate that an atom should be interpreted as strict
    bytes32 public constant ATOM_FLAG_STRICT = bytes32(uint256(1) << 248);

    // flag used to indicate that an atom should be interpreted as relative
    bytes32 public constant ATOM_FLAG_REL_QTY = bytes32(uint256(2) << 248);

    // = keccack256("grant")
    bytes32 public constant GRANT_HASH =
        0xa72fd109f1975359ff67bd5ebe67fb335d4d285dc5067f5b17f0aaa21f3d5084;

    // = keccack256("revoke")
    bytes32 public constant REVOKE_HASH =
        0x9e10ea5887e56efeb96d4464ee7be8e8f408f1a889563a625d293d9d970cc73f;

    // mapping from role-id to role-flag
    mapping(bytes32 => uint256) public roleId2Flag;

    // mapping from role-id to role-mask
    mapping(uint256 => uint256) public roleFlag2Mask;

    // mapping from user addresses to their roles
    mapping(address => uint256) public user2Roles;

    // mapping from the hash of the rule to a bit mask describing all the related roles
    mapping(bytes32 => uint256) public ruleHashToRoleFlags;

    // count of actively assigned users per role (directly only)
    mapping(bytes32 => uint256) public roleIdToNOAssignments;

    // active role-flags bit mask
    uint256 public activeRoleFlags;

    /**
     * Returns whether or not a specified user has a specified
     * role.
     *
     * @param user address of the user in question
     * @param roleId id of the role in question
     * @return userHasRole true, if the specified user has the specified role
     */
    function hasRole(
        address user,
        bytes32 roleId
    ) public view override returns (bool) {
        uint256 requiredRoleFlag = roleId2Flag[roleId];
        uint256 userRoleFlags = user2Roles[user] & activeRoleFlags;
        require(requiredRoleFlag != 0, "Unknown role");

        if ((userRoleFlags & requiredRoleFlag) == requiredRoleFlag) {
            // in this case, the user has exactly that role assigned
            // no needs for more elaborate checks
            return true;
        } else if (userRoleFlags == 0) {
            // in this case, the user has no role
            return false;
        }
        // Checks if all the bits of the bit vector "required" are also set
        // in the bit vector "actual"
        uint256 userRoleMask = _buildStructureMask(userRoleFlags);
        return (userRoleMask & requiredRoleFlag) == requiredRoleFlag;
    }

    /**
     * Returns whether or not a specified user has a specified
     * role strictly, i.e., directly assigned to it
     *
     * @param user address of the user in question
     * @param roleId id of the role in question
     * @return userHasRole true, if the specified user has the specified role
     */
    function strictlyHasRole(
        address user,
        bytes32 roleId
    ) public view override returns (bool) {
        uint256 requiredRoleFlag = roleId2Flag[roleId];
        uint256 userRoleFlags = user2Roles[user] & activeRoleFlags;
        require(requiredRoleFlag != 0, "Unknown role");

        return (userRoleFlags & requiredRoleFlag) == requiredRoleFlag;
    }

    /**
     * Execute a signed grant-request. On successed the nominee will be granted
     * the given role.
     *
     * @param approval approval of the signers to grant the role to the nominee
     * @param nominee nominee that should be granted the role
     * @param roleId role that should be granted
     */
    function grantRole(
        SignedApproval memory approval,
        address nominee,
        bytes32 roleId
    ) external override onlyValidApprovals(approval) {
        _requireValidRequest(approval, GRANT_HASH, nominee, roleId);
        uint256 roleFlag = roleId2Flag[roleId]; // at this point, guaranteed to exist

        // Granting a role by setting the according bits to 1
        if ((user2Roles[nominee] & roleFlag) == 0) {
            // Granting a role by setting the according bits to 1
            user2Roles[nominee] |= roleFlag;
            roleIdToNOAssignments[roleId]++;
        }
        emit RoleGranted(nominee, roleId);
    }

    /**
     * Execute a signed revoke-request. On successed the nominee will be revoked from
     * the given role.
     *
     * @param approval approval of the signers to revoke the role from the nominee
     * @param nominee nominee that should be revoked from the role
     * @param roleId role that should be revoked
     */
    function revokeRole(
        SignedApproval memory approval,
        address nominee,
        bytes32 roleId
    ) external override onlyValidApprovals(approval) {
        _requireValidRequest(approval, REVOKE_HASH, nominee, roleId);
        uint256 roleFlag = roleId2Flag[roleId]; // at this point, guaranteed to exist

        if ((user2Roles[nominee] & roleFlag) == roleFlag) {
            // Revoking a role by setting the according bits to 0
            user2Roles[nominee] &= ~roleFlag;
            roleIdToNOAssignments[roleId]--;
        }
        emit RoleRevoked(nominee, roleId);
    }

    /**
     * Validates a request. This involves checking if the signatures
     * are valid and checking if the signers fulfill the roles required.
     *
     * This method does not return anything but instead reverts if the
     * request is not valid.
     *
     * @param approval approval to verify
     * @param action refered action descriptor (e.g. granting a role, or revoking)
     * @param nominee nominee of the request
     */
    function _requireValidRequest(
        SignedApproval memory approval,
        bytes32 action,
        address nominee,
        bytes32 roleId
    ) internal view {
        uint256 roleFlag = roleId2Flag[roleId];
        require(roleFlag != 0, "Unknown role");

        bytes32 ruleHash = _computeRuleHash(approval, action);
        bool validRule = ruleHashToRoleFlags[ruleHash] & roleFlag == roleFlag;
        require(validRule, "Invalid rule");

        address[] memory signers;
        bool selfSigned;

        (selfSigned, signers) = getSigners(
            approval.sig,
            nominee,
            _computeUserManagementReqHash(
                nominee,
                action,
                roleId,
                approval.baseBlockHash
            )
        );

        // Request should only be signed by nominee if required
        // according to the rule
        require(
            selfSigned == approval.selfSignRequired,
            approval.selfSignRequired
                ? "Missing signature of nominee"
                : "Nominee is not expected to sign"
        );

        _requireRuleFulfillment(
            nominee,
            signers,
            approval.atoms,
            approval.assignment
        );
    }

    /**
     * Computes the hash of a rule and returns it.
     *
     * @param approval approval which contains part of the rule
     * @param action action that is covered by the rule
     * @return hashOfRule
     */
    function _computeRuleHash(
        SignedApproval memory approval,
        bytes32 action
    ) internal pure returns (bytes32) {
        bytes32 atomHash = keccak256(abi.encode(approval.atoms));

        return
            keccak256(
                abi.encode(
                    RULE_HASH,
                    action,
                    approval.selfSignRequired,
                    atomHash
                )
            );
    }

    /**
     * Computes the hash of user-management-request
     * (i.e. either revoke or grant) and returns it.
     *
     * @param nominee nominee of the role-change
     * @param action action to perform
     * @param roleId id of the role that should be changed
     * @param baseBlockHash base-block for which the signature is valid
     * @return txHash
     */
    function _computeUserManagementReqHash(
        address nominee,
        bytes32 action,
        bytes32 roleId,
        bytes32 baseBlockHash
    ) internal view returns (bytes32) {
        return
            _wrapAsEthSignedMessage(
                keccak256(
                    abi.encode(
                        USER_MGT_REQ_HASH,
                        nominee,
                        action,
                        roleId,
                        baseBlockHash
                    )
                )
            );
    }

    /**
     * Mark has as ethereum-signed-message.
     *
     * @param txHash hash to wrap
     * @return hash wrapped hash
     */
    function _wrapAsEthSignedMessage(
        bytes32 txHash
    ) internal view returns (bytes32) {
        bytes32 requestHash = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, txHash)
        );

        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    requestHash
                )
            );
    }

    /**
     * Internal function for checking if an signer-role assignment is valid.
     * This function will not return anything. Instead, in case of any error
     * it will revert the transaction.
     *
     * @param signers array of signers
     * @param atoms array of roles
     * @param assignment array of assignment with the intended meaning that
     *                   signer[i] signs for role related to atoms[assignment[i]]
     * @notice it is assumed that |signers|=|roles|=|assignment|, i.e. this has to be
     *         checked before entering this method
     * @notice this method changes the content of the signers array!!!
     */
    function _requireRuleFulfillment(
        address nominee,
        address[] memory signers,
        bytes32[] memory atoms,
        uint8[] memory assignment
    ) internal view {
        uint8[] memory cnt = new uint8[](atoms.length);

        bytes32 roleIdMask = bytes32(~(uint256(0xffff) << 240));
        for (uint8 i = 0; i < assignment.length; i++) {
            if (signers[i] == nominee) {
                // self sign
                continue;
            }

            require(atoms.length > assignment[i], "Invalid assignment");
            bytes32 atom = atoms[assignment[i]];
            if (atom & ATOM_FLAG_STRICT == ATOM_FLAG_STRICT) {
                require(
                    strictlyHasRole(signers[i], atom & roleIdMask),
                    "Invalid assignment: At least one signer does not have the specified role"
                );
                cnt[assignment[i]]++;
            } else {
                require(
                    hasRole(signers[i], atom & roleIdMask),
                    "Invalid assignment: At least one signer does not have the specified role"
                );
                cnt[assignment[i]]++;
            }
        }

        for (uint8 i = 0; i < atoms.length; i++) {
            uint256 atom = uint256(atoms[i]); // for calculation uint is more handy
            uint8 qty = uint8((atom >> 240) & 0xff);
            bytes32 role = (bytes32(atom) << 16) >> 16;

            if ((bytes32(atom) & ATOM_FLAG_REL_QTY) == ATOM_FLAG_REL_QTY) {
                qty = _getAbsNumberOfRequiredSigners(
                    roleIdToNOAssignments[role],
                    qty
                );
            }

            require(
                cnt[i] >= qty,
                "Not enough signers have signed the request"
            );
        }
    }

    /**
     * Returns the absolute number of required signers given a
     * number of users having a certain role and the percentage of
     * how many signers of that role are required.
     * This number will always be strictly larger than zero and smaller or equal
     * to the MAX_NUM_SIGNERS constant.
     * Furthermore, the number is always rounded up
     *
     * @param base number of users having a role
     * @param perc required percentage
     * @return abNumSig absolute number of required signers
     */
    function _getAbsNumberOfRequiredSigners(
        uint256 base,
        uint8 perc
    ) internal pure returns (uint8) {
        uint256 req = base * perc;
        req = (req / 100) + (req % 100 > 0 ? 1 : 0);

        if (req > MAX_NUM_SIGNERS) {
            req = MAX_NUM_SIGNERS; // Avoid locking;
        } else if (req < 1) {
            req = 1; // Avoid non-effective rule
        }
        return uint8(req); // save since req <= MAX_NUM_SIGNERS < 2^8
    }

    /**
     * Internal function building a structure mask for a bit-vector.
     * That is, for each flag set in the parameter "roleFlags", this
     * function requests the corresponding mask of the associated
     * role and combines all of them using bit-wise or.
     *
     *
     * @param roleFlags bit-vector containing all the role-flags that are junior
     *                    to the returned structure-mask
     * @return mask For the return value "v" it holds, that whenever a role is occurring
     *              directly in the parameter (its role-flag is set) or indirectly (one of
     *              its senior roles' role-flag is set), the role's role-flag is set in
     *              "v".
     */
    function _buildStructureMask(
        uint256 roleFlags
    ) internal view returns (uint256) {
        uint256 mask = 0;

        // extract all role-flags from juniorFlag
        while (roleFlags != 0) {
            uint256 role = _getPure(roleFlags);
            mask |= roleFlag2Mask[role];
            roleFlags ^= role;
        }
        return mask;
    }

    /**
     * Internal function for extracting role-flags from a mask, i.e.,
     * given an integer value, this function returns a number "x" of
     * the form 2^n (n > 0) such that (mask & x) == mask.
     *
     * @param mask mask from which the role flag should be extracted
     * @return roleFlag any role-flag occurring in the mask
     */
    function _getPure(uint256 mask) internal pure returns (uint256) {
        if (mask == 0) return 0;
        if ((mask & (mask - 1)) == 0) {
            // this condition is true if and only if, the mask
            // is already of the form 2^n (n > 1)
            return mask;
        }

        // pivot element: start at the middle
        uint256 piv = 1 << 128;
        uint256 shift = 128;

        while (shift > 0) {
            if ((piv & mask) != 0) {
                // in this case, we have found a bit
                // that is set to 1 in the mask
                return piv;
            }
            shift = shift >> 1; // divide the shift-factor by two
            piv = piv > mask ? piv >> shift : piv << shift;
        }
        return 0;
    }
}
