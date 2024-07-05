/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024 ABC Research GmbH
 *
 * This file contains an implementation of a bit vector labeled org chart using
 * mulitsig. For more details we refer to /docs/ADVANCED.md and /docs/SIGNING.md
 */
pragma solidity ^0.8.7;

import "./BitVectorOrgChart.sol";
import "./DynamicOrgChart.sol";

abstract contract DynamicBitVectorOrgChart is
    BitVectorOrgChart,
    DynamicOrgChart
{
    // = keccak256("AddRoleRequest(bytes32 roleId,bytes32 roleFlag,bytes32 seniorFlags,bytes32 juniorFlags,bytes32 hashOfRuleHashes,bytes32 baseBlockHash)")
    bytes32 public constant ADD_ROLE_REQ_HASH =
        0xb297726e9ba5e58dd2bdbcd29ed10ec45e1fba4092200e6f6574c595546e8a35;

    // = keccak256("RemoveRoleRequest(bytes32 roleId,bytes32 baseBlockHash)")
    bytes32 public constant REMOVE_ROLE_REQ_HASH =
        0xf3c1118b8decb364780535ddd1aec07c063af923a883cd0d003f1afbd5a4d20f;

    // = keccack256("admin")
    bytes32 public constant ADMIN_HASH =
        0xf23ec0bb4210edd5cba85afd05127efcd2fc6a781bfed49188da1081670b22d8;

    // The maximum number of rules that can be added for each new role
    uint256 constant MAX_NUM_RULES = 10;

    // mapping from role-list-index to role-flag
    mapping(uint8 => uint256) roleIdx2Flag;

    // mapping from role-flag to direct-junior-mask
    mapping(uint256 => uint256) public roleFlag2JuniorMask;

    // Counter for number of active roles
    uint8 public numOfActiveRoles;

    // Free role-flags bit mask
    uint256 public freeRoleFlags;

    /**
     * Add a role to the org chart
     *
     * @param approval approval for removinig the role
     * @param roleDef definition of the role that should be added
     */
    function addRole(
        SignedApproval memory approval,
        RoleDef memory roleDef
    ) public override {
        require(
            !approval.selfSignRequired,
            "Self-sign not allowed for admin-rules"
        );
        _requireValidRoleDef(roleDef);
        _requireValidAddRoleRequest(approval, roleDef);

        // A cycle can be easily detected by building up the role mask and
        // check if it contains one of the parent flags
        uint256 newRoleMask = _buildStructureMask(roleDef.juniorFlags) |
            roleDef.roleFlag;
        require(newRoleMask & roleDef.seniorFlags == 0, "Cycle detected");

        // The index of the first parent is needed for insertion in the reversed-topologically
        // ordered array of roles
        uint8 firstParent = numOfActiveRoles;
        for (uint8 i = 0; i < numOfActiveRoles; i++) {
            uint256 roleFlag = roleIdx2Flag[i];
            uint256 roleMask = roleFlag2Mask[roleFlag];

            if (roleDef.seniorFlags & roleFlag != 0) {
                // in this case, it is a direct parent and we have to adapt
                // the mask containing the flags of all the direct junior roles
                roleFlag2JuniorMask[roleFlag] |= roleDef.roleFlag;
                firstParent = i <= firstParent ? i : firstParent;
            }
            if (roleMask & roleDef.seniorFlags != 0) {
                // in this case, the new role is a (maybe indirect) junior role and
                // we have to adapt the mask describing the structure
                roleFlag2Mask[roleFlag] |= newRoleMask;
            }
        }

        // make space for the new role in the array of roles
        // by adding the new role in front of the first parent
        // we ensure preservation of the reversed-topological order
        _shiftRightRoleIdx(firstParent);

        // Actually adding the role to the org chart
        roleIdx2Flag[firstParent] = roleDef.roleFlag;
        roleId2Flag[roleDef.roleId] = roleDef.roleFlag;
        roleFlag2JuniorMask[roleDef.roleFlag] = roleDef.juniorFlags;
        roleFlag2Mask[roleDef.roleFlag] = newRoleMask;

        for (uint8 i = 0; i < roleDef.ruleHashes.length; i++) {
            ruleHashToRoleFlags[roleDef.ruleHashes[i]] |= roleDef.roleFlag;
        }

        freeRoleFlags ^= roleDef.roleFlag;
        activeRoleFlags |= roleDef.roleFlag;
        emit RoleAdded(
            roleDef.roleId,
            roleDef.seniorFlags,
            roleDef.juniorFlags
        );
    }

    /**
     * Removes a role from the org chart
     *
     * @param approval approval for removinig the role
     * @param roleId id of the role that should be deleted
     */
    function removeRole(
        SignedApproval memory approval,
        bytes32 roleId
    ) public override {
        require(
            !approval.selfSignRequired,
            "Self-sign not allowed for admin-rules"
        );
        uint256 delRoleFlag = roleId2Flag[roleId];
        require(delRoleFlag != 0, "Role does not exist");

        _requireValidRemoveRequest(approval, roleId);

        // we need the index of the role in order to delete
        // it from the array of roles
        uint8 roleIdx;
        for (uint8 i = 0; i < numOfActiveRoles; i++) {
            uint256 roleFlag = roleIdx2Flag[i];
            if (roleFlag == delRoleFlag) {
                roleIdx = i;
                continue;
            }
            uint256 roleMask = roleFlag2Mask[roleFlag];
            uint256 juniorMask = roleFlag2JuniorMask[roleFlag];

            if (juniorMask & delRoleFlag != 0) {
                // in this case, the role is a direct parent of the
                // role that will be deleted, i.e., we have to adapt
                // the mask of the flags of all the direct junior roles
                juniorMask ^= delRoleFlag;
                roleFlag2JuniorMask[roleFlag] = juniorMask;
            }
            if (roleMask & delRoleFlag != 0) {
                // in this case, the role is a (maybe indirect) parent of
                // the role that will be deleted. In this case, we rebuild the
                // structure mask.
                roleFlag2Mask[roleFlag] =
                    _buildStructureMask(juniorMask) |
                    roleFlag;
            }
        }

        // remove the role from the reversed-topological order
        _shiftLeftRoleIdx(roleIdx);

        // Final cleanups
        delete roleId2Flag[roleId];
        delete roleFlag2Mask[delRoleFlag];
        delete roleFlag2JuniorMask[delRoleFlag];

        activeRoleFlags ^= delRoleFlag;
        emit RoleRemoved(roleId);
    }

    /**
     * Some basic validation steps for role definition. Includes the
     * following checks:
     *      - role-flag is well-formed
     *      - role-flag is not already taken
     *      - role-id is well-formed
     *      - role-id is not already taken
     *      - all senior roles exist
     *      - all junior roles exist
     *
     * Note that the function does not return anything but instead
     * reverts in case of failure
     *
     * @param roleDef defintion of the role to add
     */
    function _requireValidRoleDef(RoleDef memory roleDef) internal view {
        // Some basic sanity checks to avoid malformed structures
        require(
            roleDef.roleFlag & (roleDef.roleFlag - 1) == 0,
            "Only one bit is allowed to be set to 1"
        );
        require(
            roleDef.roleFlag & freeRoleFlags != 0,
            "Role flag already taken"
        );
        require(
            ((roleDef.roleId << 16) >> 16) == roleDef.roleId,
            "Role id is only allowed to take up the first 30 bytes"
        );
        require(roleId2Flag[roleDef.roleId] == 0, "Role id already taken");
        require(
            roleDef.seniorFlags & ~freeRoleFlags == roleDef.seniorFlags,
            "One or more senior roles do not exist"
        );
        require(
            roleDef.juniorFlags & ~freeRoleFlags == roleDef.juniorFlags,
            "One or more junior roles do not exist"
        );
        require(
            roleDef.ruleHashes.length < MAX_NUM_RULES,
            "Maximum number of rules exceeded"
        );
    }

    /**
     * Check if the approval of an add-role-request is valid.
     * This check involves checking the signature and verify role-
     * fulfillment.
     *
     * Note that this function does not return anything but instead
     * reverts on failure
     *
     * @param approval approval to verify
     * @param roleDef definition of the role
     */
    function _requireValidAddRoleRequest(
        SignedApproval memory approval,
        RoleDef memory roleDef
    ) internal view {
        return
            _requireValidAdminRequest(
                approval,
                _computeAddRoleReqHash(roleDef, approval.baseBlockHash)
            );
    }

    /**
     * Check if the approval of an remove-role-request is valid.
     * This check involves checking the signature and verify role-
     * fulfillment.
     *
     * Note that this function does not return anything but instead
     * reverts on failure
     *
     * @param approval approval to verify
     * @param roleId role to delete
     */
    function _requireValidRemoveRequest(
        SignedApproval memory approval,
        bytes32 roleId
    ) internal view {
        return
            _requireValidAdminRequest(
                approval,
                _computeRemoveRoleReqHash(roleId, approval.baseBlockHash)
            );
    }

    /**
     * Check if the approval of an admin-request is valid.
     * This check involves checking the signature and verify role-
     * fulfillment.
     *
     * Note that this function does not return anything but instead
     * reverts on failure
     *
     * @param approval approval to verify
     * @param targetHash hash to verify against
     */
    function _requireValidAdminRequest(
        SignedApproval memory approval,
        bytes32 targetHash
    ) internal view {
        bytes32 ruleHash = _computeRuleHash(approval, ADMIN_HASH);

        require(
            ruleHashToRoleFlags[ruleHash] == type(uint256).max,
            "Invalid admin-rule"
        );

        address[] memory signers;
        bool dummy;

        (dummy, signers) = getSigners(approval.sig, address(0), targetHash);

        _requireRuleFulfillment(
            address(0),
            signers,
            approval.atoms,
            approval.assignment
        );
    }

    /**
     * Computes the hash of an add-role request
     *
     * @param roleDef definition of the role
     * @param baseBlockHash base-block for which the transaction is valid
     * @return hashOfTx
     */
    function _computeAddRoleReqHash(
        RoleDef memory roleDef,
        bytes32 baseBlockHash
    ) internal view returns (bytes32) {
        return
            _wrapAsEthSignedMessage(
                keccak256(
                    abi.encode(
                        ADD_ROLE_REQ_HASH,
                        roleDef.roleId,
                        roleDef.roleFlag,
                        roleDef.seniorFlags,
                        roleDef.juniorFlags,
                        keccak256(abi.encode(roleDef.ruleHashes)),
                        baseBlockHash
                    )
                )
            );
    }

    /**
     * Computes the hash of a remove-role request
     *
     * @param roleId id of the role to delete
     * @param baseBlockHash base-block for which the transaction is valid
     * @return hashOfTx
     */
    function _computeRemoveRoleReqHash(
        bytes32 roleId,
        bytes32 baseBlockHash
    ) internal view returns (bytes32) {
        return
            _wrapAsEthSignedMessage(
                keccak256(
                    abi.encode(REMOVE_ROLE_REQ_HASH, roleId, baseBlockHash)
                )
            );
    }

    /**
     * Shifts the roles by one to the "right" inside the roleIdx2roleFlag mapping
     * starting from a given index. This will move the i'th element to the (i+1)'th element
     * starting from the last one up to the specified index. This way, no role gets
     * overwritten
     *
     * @param from index from where to start
     * @notice this function will increase the counter numOfActiveRoles
     * @notice after this function, the value previously stored at roleIdx2Flag[form] occurs
     *         now twice: once at position from and once on position (from + 1)
     */
    function _shiftRightRoleIdx(uint8 from) internal {
        for (uint8 i = numOfActiveRoles; i > from; i--) {
            roleIdx2Flag[i] = roleIdx2Flag[i - 1];
        }
        numOfActiveRoles += 1;
    }

    /**
     * Shifts the roles by one to the "left" inside the roleIdx2roleFlag mapping
     * starting from a given index. This will move the (i+1)'th element to the (i)'th element
     * starting from the specified index. This way, the specified index will get overwritten
     *
     * @param to index where to stop shifting
     * @notice this function will decrease the counter numOfActiveRoles
     * @notice after this function, the value previously stored at roleIdx2Flag[to] will
     *         be overwritten by roleIdx2Flag[to+1] (referring to the previously order)
     */
    function _shiftLeftRoleIdx(uint8 to) internal {
        for (uint8 i = to; i < numOfActiveRoles - 1; i++) {
            roleIdx2Flag[i] = roleIdx2Flag[i + 1];
        }
        delete roleIdx2Flag[numOfActiveRoles - 1];
        numOfActiveRoles -= 1;
    }
}
