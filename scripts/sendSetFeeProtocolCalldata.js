/**
 * sendSetFeeProtocolCalldata.js
 *
 * This script executes the setFeeProtocol function on a Uniswap V3 Pool via cross-chain governance.
 *
 * ABOUT setFeeProtocol:
 * The setFeeProtocol function sets the protocol fee for a specific Uniswap V3 Pool. This fee is taken
 * from the LP fees and sent to a protocol fee collector address.
 *
 * Function signature: setFeeProtocol(uint8 feeProtocol0, uint8 feeProtocol1)
 *
 * Parameters:
 * - feeProtocol0: The protocol fee for token0 (denominator is 10, so 4 = 40% of LP fee)
 * - feeProtocol1: The protocol fee for token1 (denominator is 10, so 4 = 40% of LP fee)
 *
 * Valid values: 0-10 for each parameter
 * - 0 = No protocol fee (0%)
 * - 4 = 40% of LP fee goes to protocol
 * - 5 = 50% of LP fee goes to protocol
 * - 10 = 100% of LP fee goes to protocol
 *
 * Example: If a pool has 0.3% LP fee and feeProtocol0 = 4:
 * - LPs get: 0.3% * (1 - 0.4) = 0.18%
 * - Protocol gets: 0.3% * 0.4 = 0.12%
 *
 * IMPORTANT: Only the factory contract can call setFeeProtocol on a pool. The OmnichainGovernanceExecutor
 * must be set as the owner of the Uniswap V3 Factory, and the call must be made through the factory's
 * setOwner or similar mechanism, OR the pool must be configured to allow the executor to call this directly.
 *
 * NOTE: This script targets a specific pool address. Update the poolAddress variable below to target
 * a different pool.
 */

const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    // ============================================
    // SETUP
    // ============================================
    const senderAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E"
    const remoteChainId = 396
    const executorAddress = "0x917791cF935260b3BfF6840a84C764C8d8A6352b"
    const contractName = "OmnichainProposalSender"
    const [signer] = await ethers.getSigners()
    const SenderContract = await ethers.getContractFactory(contractName)
    const senderContract = SenderContract.attach(senderAddress)

    // ============================================
    // FUNCTION PARAMETERS
    // ============================================

    // Target Uniswap V3 Pool address on the destination chain
    // This should be the specific pool contract address (e.g., WETH/USDC pool)
    const poolAddress = "0x2538BFC8DE001591f06A09dF999a52628903b208"

    // Protocol fee parameters (0-10, where denominator is 10)
    // Setting 4 means 40% of the LP fee goes to the protocol
    const feeProtocol0 = 4 // Protocol fee for token0 (4 = 40%)
    const feeProtocol1 = 4 // Protocol fee for token1 (4 = 40%)

    console.log("\n=== setFeeProtocol Parameters ===")
    console.log(`Target Pool: ${poolAddress}`)
    console.log(`feeProtocol0: ${feeProtocol0} (${feeProtocol0 * 10}% of LP fees)`)
    console.log(`feeProtocol1: ${feeProtocol1} (${feeProtocol1 * 10}% of LP fees)`)

    // Create the calldata for setFeeProtocol
    const uniswapV3PoolInterface = new hre.ethers.utils.Interface(["function setFeeProtocol(uint8 feeProtocol0, uint8 feeProtocol1)"])
    const setFeeProtocolCallData = uniswapV3PoolInterface.encodeFunctionData("setFeeProtocol", [feeProtocol0, feeProtocol1])
    console.log("\nsetFeeProtocol calldata:", setFeeProtocolCallData)

    // ============================================
    // ADAPTER PARAMS (GAS CONFIGURATION)
    // ============================================
    const adapterParams = ethers.utils.solidityPack(
        ["uint16", "uint256"],
        [1, 200000] // version, gasLimit
    )
    console.log("adapter params:", adapterParams)

    // ============================================
    // BUILD PAYLOAD
    // ============================================

    // Build the payload for OmnichainGovernanceExecutor
    // The executor expects: abi.encode(targets, values, signatures, calldatas)
    const targets = [poolAddress]
    const values = [0] // No ETH sent with the call
    const signatures = ["setFeeProtocol(uint8,uint8)"] // Function signature
    const calldatas = [ethers.utils.defaultAbiCoder.encode(["uint8", "uint8"], [feeProtocol0, feeProtocol1])]

    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )
    console.log("\nComplete payload:", payload)

    // ============================================
    // ESTIMATE FEES
    // ============================================
    try {
        console.log("\n=== Estimating LayerZero Fees ===")
        const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
        console.log("Estimated fees:")
        console.log("  nativeFee:", ethers.utils.formatEther(estimatedFee[0]), "ETH")
        console.log("  zroFee:", estimatedFee[1].toString())

        // ============================================
        // EXECUTE TRANSACTION
        // ============================================

        console.log("\n=== Executing Cross-Chain Transaction ===")
        console.log(`Sending to chain: ${remoteChainId}`)
        console.log(`Target pool: ${poolAddress}`)
        console.log(`Executor address: ${executorAddress}`)
        console.log(`Signer: ${signer.address}`)

        // Add 20% buffer to the estimated fee for safety
        const feeWithBuffer = estimatedFee[0].mul(120).div(100)
        console.log(`\nFee with 20% buffer: ${ethers.utils.formatEther(feeWithBuffer)} ETH`)

        console.log("\nSending transaction...")
        const tx = await senderContract.execute(remoteChainId, payload, adapterParams, {
            value: feeWithBuffer,
        })
        console.log(`Transaction hash: ${tx.hash}`)
        console.log("Waiting for confirmation...")

        const receipt = await tx.wait()
        console.log(`\n✓ Transaction confirmed in block ${receipt.blockNumber}`)
        console.log(`Gas used: ${receipt.gasUsed.toString()}`)

        // ============================================
        // CHECK RESULTS
        // ============================================

        // Check for ExecuteRemoteProposal event
        const executeEvent = receipt.events?.find((e) => e.event === "ExecuteRemoteProposal")
        if (executeEvent) {
            console.log("\n✓ setFeeProtocol proposal sent successfully!")
            console.log("\nThe protocol fees will be updated on the destination chain once relayed.")
            console.log("\nNext steps:")
            console.log("1. Monitor LayerZero for cross-chain message delivery")
            console.log("2. Verify the protocol fee was updated on the destination chain")
            console.log(`3. Check the pool's slot0() to see feeProtocol values at: ${poolAddress}`)
            console.log("\nHow to verify:")
            console.log("  Call pool.slot0() and check the feeProtocol field")
            console.log("  The value should reflect your new settings (feeProtocol0 in lower 4 bits, feeProtocol1 in upper 4 bits)")
        } else {
            // Check for StorePayload event (if sending failed)
            const storeEvent = receipt.events?.find((e) => e.event === "StorePayload")
            if (storeEvent) {
                console.log("\n⚠ Proposal sending failed and was stored for retry")
                console.log(`Stored nonce: ${storeEvent.args.nonce}`)
                console.log(`Failure reason: ${storeEvent.args.reason}`)
                console.log("\nTo retry, use the retryExecute function with:")
                console.log(`- nonce: ${storeEvent.args.nonce}`)
                console.log(`- remoteChainId: ${remoteChainId}`)
                console.log(`- payload: ${payload}`)
                console.log(`- adapterParams: ${adapterParams}`)
                console.log(`- originalValue: ${estimatedFee[0].toString()}`)
            }
        }

        console.log("\n=== Execution Complete ===\n")
    } catch (e) {
        console.error("\n❌ Error:", e.message)
        if (e.error) {
            console.error("Error details:", e.error)
        }
        throw e
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
