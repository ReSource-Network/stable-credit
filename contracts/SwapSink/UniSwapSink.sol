// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import "../interface/IStableCredit.sol";
import "./ISwapRouter02.sol";
import "./SwapSink.sol";

/// @title CeloUniSwapSink
/// @author ReSource 
/// @notice Converts collected tokens to SOURCE used to back inter-network swaps
/// @dev This contract interacts with the Uniswap protocol. Ensure the targeted pool
/// has sufficient liquidity.
contract UniSwapSink is SwapSink {
    /* ========== STATE VARIABLES ========== */

    ICeloSwapRouter public swapRouter;
    uint24 public poolFee;

    /* ========== INITIALIZER ========== */

    function initialize(
        address _stableCredit,
        address _sourceAddress,
        address _swapRouter
    ) public initializer {
        __SwapSink_init(_stableCredit, _sourceAddress);
        swapRouter = ICeloSwapRouter(_swapRouter);
        poolFee = 3000;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function convertFeesToSwapToken() external override whenNotPaused {
        IERC20Upgradeable feeToken = IERC20Upgradeable(stableCredit.feeToken());
        uint256 feeBalance = feeToken.balanceOf(address(this));
        TransferHelper.safeApprove(address(feeToken), address(swapRouter), feeBalance);

        ICeloSwapRouter.ExactInputSingleParams memory params = ICeloSwapRouter
            .ExactInputSingleParams({
                tokenIn: stableCredit.feeToken(),
                tokenOut: source,
                fee: poolFee,
                recipient: address(this),
                amountIn: feeBalance,
                /// use price oracle to add safety
                amountOutMinimum: 1,
                sqrtPriceLimitX96: 0
            });

        swapRouter.exactInputSingle(params);
    }


    /* ========== RESTRICTED FUNCTIONS ========== */

    function setPoolFee(uint24 _poolFee) external onlyOwner {
        poolFee = _poolFee;
    }
}