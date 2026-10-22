// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ManuscriptRegistry
/// @notice Registers an immutable proof-of-ownership for a manuscript: who
/// registered it, a content hash (SHA-256 of title+content+author, computed
/// off-chain — matches the same hash format used elsewhere in the platform
/// for consistency), and the block timestamp. Also keeps every subsequent
/// re-registration as a version history entry, so edits are auditable.
contract ManuscriptRegistry {
    struct Version {
        bytes32 contentHash;
        uint256 timestamp;
    }

    struct Registration {
        address author;
        uint256 registeredAt;
        bool exists;
    }

    // manuscriptId (an off-chain id, e.g. the MongoDB ObjectId as bytes32) => registration
    mapping(bytes32 => Registration) public registrations;

    // manuscriptId => ordered list of every content-hash snapshot ever recorded for it
    mapping(bytes32 => Version[]) private history;

    event ManuscriptRegistered(bytes32 indexed manuscriptId, address indexed author, bytes32 contentHash, uint256 timestamp);
    event ManuscriptUpdated(bytes32 indexed manuscriptId, bytes32 contentHash, uint256 timestamp);

    /// @notice Registers a manuscript for the first time. Reverts if this
    /// manuscriptId is already registered — use updateManuscript for edits.
    function registerManuscript(bytes32 manuscriptId, bytes32 contentHash) external {
        require(!registrations[manuscriptId].exists, "Manuscript already registered");
        require(contentHash != bytes32(0), "Content hash required");

        registrations[manuscriptId] = Registration({
            author: msg.sender,
            registeredAt: block.timestamp,
            exists: true
        });
        history[manuscriptId].push(Version({ contentHash: contentHash, timestamp: block.timestamp }));

        emit ManuscriptRegistered(manuscriptId, msg.sender, contentHash, block.timestamp);
    }

    /// @notice Records a new content-hash snapshot for an already-registered
    /// manuscript. Only the original registering author's wallet may call
    /// this — mirrors the off-chain ownership check in the backend.
    function updateManuscript(bytes32 manuscriptId, bytes32 contentHash) external {
        Registration memory reg = registrations[manuscriptId];
        require(reg.exists, "Manuscript not registered");
        require(reg.author == msg.sender, "Only the registering author can update this manuscript");
        require(contentHash != bytes32(0), "Content hash required");

        history[manuscriptId].push(Version({ contentHash: contentHash, timestamp: block.timestamp }));

        emit ManuscriptUpdated(manuscriptId, contentHash, block.timestamp);
    }

    /// @notice Checks whether a given content hash matches the CURRENT
    /// (most recent) on-chain hash for a manuscript — i.e. "has this exact
    /// text been tampered with since the last registered snapshot?"
    function verifyManuscript(bytes32 manuscriptId, bytes32 contentHash) external view returns (bool) {
        Version[] storage versions = history[manuscriptId];
        if (versions.length == 0) return false;
        return versions[versions.length - 1].contentHash == contentHash;
    }

    /// @notice Returns the full on-chain version history for a manuscript.
    function getHistory(bytes32 manuscriptId) external view returns (Version[] memory) {
        return history[manuscriptId];
    }

    /// @notice Returns how many versions have been recorded for a manuscript.
    function getVersionCount(bytes32 manuscriptId) external view returns (uint256) {
        return history[manuscriptId].length;
    }
}
