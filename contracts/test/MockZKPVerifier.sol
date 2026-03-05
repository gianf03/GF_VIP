// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IZKPVerifier.sol";

/**
 * @title MockZKPVerifier
 * @notice A test-only mock that implements IZKPVerifier.
 *         The test suite can call setShouldReturn(true/false) to control
 *         whether verify() passes or fails, letting us simulate both
 *         valid and invalid proofs without needing a real ZK circuit.
 *
 * DO NOT deploy this on a real network — it provides no actual security.
 */
contract MockZKPVerifier is IZKPVerifier {
    bool private _shouldReturn;

    /**
     * @notice Set the return value for the next verify() call.
     * @param result  true = proof valid, false = proof invalid.
     */
    function setShouldReturn(bool result) external {
        _shouldReturn = result;
    }

    /// @inheritdoc IZKPVerifier
    function verify(
        bytes32 /* commitment — ignored in mock */,
        bytes calldata /* proof    — ignored in mock */,
        bytes calldata /* publicInputs — ignored in mock */
    ) external view override returns (bool) {
        return _shouldReturn;
    }
}
