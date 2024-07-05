/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024 ABC Research GmbH
 *
 * Basice interface of an dynamic org-chart contract
 */
pragma solidity ^0.8.7;

import "./OrgChart.sol";

abstract contract DynamicOrgChart is OrgChart {
    event RoleAdded(bytes32 roleId, uint256 seniorFlags, uint256 juniorFlags);
    event RoleRemoved(bytes32 roleId);

    struct RoleDef {
        bytes32 roleId;
        uint256 roleFlag;
        uint256 seniorFlags;
        uint256 juniorFlags;
        bytes32[] ruleHashes;
    }

    /**
     * Add a role to the org chart
     *
     * @param approval approval for removinig the role
     * @param roleDef definition of the role that should be added
     */
    function addRole(
        SignedApproval memory approval,
        RoleDef memory roleDef
    ) public virtual;

    /**
     * Removes a role from the org chart
     *
     * @param approval approval for removinig the role
     * @param roleId id of the role that should be deleted
     */
    function removeRole(
        SignedApproval memory approval,
        bytes32 roleId
    ) public virtual;
}
