/**
 * sendMixedBatchCalldata.js
 *
 * This script demonstrates batching calls to MULTIPLE DIFFERENT CONTRACTS in a single cross-chain transaction.
 *
 * EXAMPLE USE CASE:
 * This script enables a new fee tier on the Uniswap V3 Factory AND sets protocol fees on a specific pool,
 * all in one atomic cross-chain transaction.
 *
 * WHY BATCH DIFFERENT CONTRACTS?
 * - Atomic execution: Either all calls succeed or all fail (no partial state)
 * - Cost efficient: Pay LayerZero fees once for multiple operations
 * - Coordinated governance: Update related settings across contracts simultaneously
 *
 * HOW IT WORKS:
 * The payload contains arrays where each index represents one call:
 * - targets[0] = Factory address, targets[1] = Pool address
 * - signatures[0] = enableFeeAmount(...), signatures[1] = setFeeProtocol(...)
 * - Each call can target any contract address with any function
 *
 * EXECUTION ORDER:
 * Calls are executed sequentially in array order. If any call fails, the entire batch reverts.
 */

const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    // ============================================
    // SETUP
    // ============================================

    const senderAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E"
    const contractName = "OmnichainProposalSender"
    const remoteChainId = 396
    const executorAddress = "0x917791cF935260b3BfF6840a84C764C8d8A6352b"

    const [signer] = await ethers.getSigners()
    const SenderContract = await ethers.getContractFactory(contractName)
    const senderContract = SenderContract.attach(senderAddress)

    // ============================================
    // TARGET CONTRACTS
    // ============================================

    const uniswapV3FactoryAddress = "0xd84f7E85e8A0FA35a945b52593dA39521d7a178f"
    const uniswapV3PoolAddress = "0x2538BFC8DE001591f06A09dF999a52628903b208"

    // ============================================
    // CALL 1: enableFeeAmount on Factory
    // ============================================

    const newFee = 505 // 0.05% fee tier
    const newTickSpacing = 10

    console.log("\n=== Call 1: enableFeeAmount on Factory ===")
    console.log(`Target: ${uniswapV3FactoryAddress}`)
    console.log(`Fee: ${newFee} (${newFee / 10000}%)`)
    console.log(`Tick Spacing: ${newTickSpacing}`)

    // ============================================
    // CALL 2: setFeeProtocol on Pool
    // ============================================

    const feeProtocol0 = 3 // 40% of LP fees
    const feeProtocol1 = 3 // 40% of LP fees

    console.log("\n=== Call 2: setFeeProtocol on Pool ===")
    console.log(`Target: ${uniswapV3PoolAddress}`)
    console.log(`feeProtocol0: ${feeProtocol0} (${feeProtocol0 * 10}%)`)
    console.log(`feeProtocol1: ${feeProtocol1} (${feeProtocol1 * 10}%)`)

    // ============================================
    // BUILD BATCH PAYLOAD
    // ============================================

    console.log("\n=== Building Batch Payload ===")

    // Array of target contract addresses (can be different!)
    const targets = [
        uniswapV3FactoryAddress, // Call 1 targets Factory
        uniswapV3PoolAddress, // Call 2 targets Pool
    ]

    // Array of ETH values to send with each call
    const values = [
        0, // No ETH for enableFeeAmount
        0, // No ETH for setFeeProtocol
    ]

    // Array of function signatures
    const signatures = [
        "enableFeeAmount(uint24,int24)", // Factory function
        "setFeeProtocol(uint8,uint8)", // Pool function
    ]

    // Array of encoded parameters for each call
    const calldatas = [
        ethers.utils.defaultAbiCoder.encode(["uint24", "int24"], [newFee, newTickSpacing]),
        ethers.utils.defaultAbiCoder.encode(["uint8", "uint8"], [feeProtocol0, feeProtocol1]),
    ]

    console.log(`Number of calls in batch: ${targets.length}`)
    console.log(`Call 1 encoded params: ${calldatas[0]}`)
    console.log(`Call 2 encoded params: ${calldatas[1]}`)

    // Encode complete payload
    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )
    console.log(`\nComplete payload: ${payload}`)

    // ============================================
    // ADAPTER PARAMS (GAS CONFIGURATION)
    // ============================================

    // Increase gas limit for multiple contract calls
    const gasLimit = 400000
    const adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, gasLimit])
    console.log(`\nAdapter params (gasLimit: ${gasLimit}): ${adapterParams}`)

    // ============================================
    // ESTIMATE FEES
    // ============================================

    try {
        console.log("\n=== Estimating LayerZero Fees ===")
        const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
        console.log("Estimated fees:")
        console.log(`  Native fee: ${ethers.utils.formatEther(estimatedFee[0])} ETH`)
        console.log(`  ZRO fee: ${estimatedFee[1].toString()}`)

        // ============================================
        // EXECUTE TRANSACTION
        // ============================================

        console.log("\n=== Executing Cross-Chain Batch Transaction ===")
        console.log(`Source contract: ${senderAddress}`)
        console.log(`Destination chain: ${remoteChainId}`)
        console.log(`Executor: ${executorAddress}`)
        console.log(`Signer: ${signer.address}`)
        console.log(`\nBatch contents:`)
        console.log(`  1. enableFeeAmount() on Factory ${uniswapV3FactoryAddress}`)
        console.log(`  2. setFeeProtocol() on Pool ${uniswapV3PoolAddress}`)

        // Add 20% buffer to estimated fee
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

        const executeEvent = receipt.events?.find((e) => e.event === "ExecuteRemoteProposal")
        if (executeEvent) {
            console.log("\n✓ Multi-contract batch proposal sent successfully!")
            console.log("\nThe following will be executed atomically on the destination chain:")
            console.log(`  1. Factory.enableFeeAmount(${newFee}, ${newTickSpacing})`)
            console.log(`  2. Pool.setFeeProtocol(${feeProtocol0}, ${feeProtocol1})`)
            console.log("\nNext steps:")
            console.log("1. Monitor LayerZero for cross-chain delivery")
            console.log(`2. Verify new fee tier ${newFee} is enabled on Factory`)
            console.log(`3. Verify protocol fee was set on Pool via slot0()`)
            console.log("\nIMPORTANT: If any call fails, the entire batch will revert!")
        } else {
            const storeEvent = receipt.events?.find((e) => e.event === "StorePayload")
            if (storeEvent) {
                console.log("\n⚠ Batch proposal failed and was stored for retry")
                console.log(`Stored nonce: ${storeEvent.args.nonce}`)
                console.log(`Failure reason: ${storeEvent.args.reason}`)
                console.log("\nRetry parameters:")
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
