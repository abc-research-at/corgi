/**
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2024 ABC Research GmbH
 *
 * Basice interface of an org-chart contract
 */
pragma solidity ^0.8.7;

import "./MultiSignable.sol";

abstract contract OrgChart is MultiSignable {
    // Number of blocks that should be considered as history for the base-block-check.
    // For example, if set to "3", only the last three blocks will be checked
    uint8 public constant LOOK_BACK_LENGTH = 3;

    // maximal number of signers allowed
    uint256 public constant MAX_NUM_SIGNERS = 100;

    // Definition of the domain-separator data structure
    // = keccack256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)")
    bytes32 public constant EIP712_DOMAIN_TYPE_HASH =
        0xd87cd6ef79d4e2b95e15ce8abf732db51ec771f1ca2edccf22a46c729ac56472;

    // Hash of the contracts name
    // = keccack256("OrgChart")
    bytes32 public constant NAME_HASH =
        0xf79310e2384d4cc5a5f57b642dd5c236aa2344053942c31e8c59d3abd597c467;

    // Hash of the contracts version
    // = keccack256("1")
    bytes32 public constant VERSION_HASH =
        0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6;

    // Everything is better with a pinch of salt
    bytes32 public constant SALT =
        0x9cf69971c503e34e205aa5d3003914d50dd071efbc900bf30fbda4634d062b1e;

    // will be set in the constructor and will not cange afterwards
    bytes32 public DOMAIN_SEPARATOR;

    event RoleGranted(address nominee, bytes32 roleId);
    event RoleRevoked(address nominee, bytes32 roleId);

    struct SignedApproval {
        Signature[] sig; // signatures of the signers
        bytes32[] atoms; // atoms of the rule
        uint8[] assignment; // assignment from atoms to signers
        bool selfSignRequired; // flag indicating if rule requires a self-sign
        bytes32 baseBlockHash; // hash of the base block
    }

    /**
     * Modifier carrying out some basic saniy checks on the approval
     *
     * @param approval approval to check
     */
    modifier onlyValidApprovals(SignedApproval memory approval) {
        require(
            _isValidBaseBlock(approval.baseBlockHash),
            "Signature out-dated or not valid on this fork. Reeisue a new signature"
        );
        require(
            approval.sig.length <= MAX_NUM_SIGNERS,
            "To many signers! Cannot process"
        );
        require(
            approval.sig.length == approval.sig.length,
            "Invalid arguments: Assignment length must match number of signatures"
        );
        _;
    }

    /**
     * Constructor: Sets the domain separator for the contract
     */
    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPE_HASH,
                NAME_HASH,
                VERSION_HASH,
                _getChainId(),
                this,
                SALT
            )
        );
    }

    /**
     * Modifier for access control; only passes if the sender
     * has the specified role
     *
     * @param roleId role to check for
     */
    modifier only(bytes32 roleId) {
        address sender = msg.sender;
        require(hasRole(sender, roleId), "Permission denied");
        _;
    }

    /**
     * Modifier for access control; only passes if the sender
     * has strictly the specified role
     *
     * @param roleId role to check for (strictly)
     */
    modifier strictlyOnly(bytes32 roleId) {
        address sender = msg.sender;
        require(strictlyHasRole(sender, roleId), "Permssion denied");
        _;
    }

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
    ) public view virtual returns (bool);

    /**
     * Returns whether or not a specified user has a specified
     * role striclty, i.e., directly assigned to it
     *
     * @param user address of the user in question
     * @param roleId id of the role in question
     * @return userHasRole true, if the specified user has the specified role
     */
    function strictlyHasRole(
        address user,
        bytes32 roleId
    ) public view virtual returns (bool);

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
    ) external virtual;

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
    ) external virtual;

    /**
     * Checks whether a given block hash occurs in the history of the current block.
     * This function will only look for the last LOOK_BACK_LENGTH blocks
     *
     * @param baseBlockHash block hash to check
     * @return occursInHistory
     */
    function _isValidBaseBlock(
        bytes32 baseBlockHash
    ) internal view returns (bool) {
        for (uint8 i = 1; i <= LOOK_BACK_LENGTH; i++) {
            if (blockhash(block.number - i) == baseBlockHash) return true;
        }
        return false;
    }

    /**
     * Internal helper function for requesting the chain id
     *
     * @return chainId id of the current environment's chain-id
     */
    function _getChainId() internal view returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
