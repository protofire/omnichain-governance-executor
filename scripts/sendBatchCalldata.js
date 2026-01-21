/**
 * sendBatchCalldata.js
 *
 * This script demonstrates how to send multiple transactions in a single cross-chain batch call
 * using the OmnichainProposalSender and OmnichainGovernanceExecutor contracts.
 *
 * HOW IT WORKS:
 * 1. The OmnichainProposalSender on the source chain encodes multiple calls into a single payload
 * 2. LayerZero transmits the payload to the destination chain
 * 3. The OmnichainGovernanceExecutor on the destination chain decodes and executes each call sequentially
 *
 * PAYLOAD FORMAT:
 * The payload is ABI-encoded as: abi.encode(targets[], values[], signatures[], calldatas[])
 * - targets[]: Array of contract addresses to call
 * - values[]: Array of ETH amounts to send with each call (in wei)
 * - signatures[]: Array of function signatures (e.g., "functionName(type1,type2)")
 * - calldatas[]: Array of ABI-encoded parameters for each function call
 *
 * EXAMPLE USE CASES:
 * - Enable multiple fee tiers on Uniswap V3 Factory in one transaction
 * - Configure multiple protocol parameters atomically
 * - Execute governance actions across multiple contracts
 * - Perform complex multi-step operations that must succeed or fail together
 *
 * NOTE: All transactions in the batch are executed sequentially. If any transaction fails,
 * the entire batch will revert.
 */

const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    // ============================================
    // CONFIGURATION
    // ============================================

    // Sender contract on source chain
    const senderAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E"
    const contractName = "OmnichainProposalSender"

    // LayerZero chain ID for destination chain
    const remoteChainId = 396 // Replace with your destination chain ID

    // Executor contract on destination chain (for reference/logging only)
    const executorAddress = "0x917791cF935260b3BfB6840a84C764C8d8A6352b"

    // Get signer
    const [signer] = await ethers.getSigners()
    const SenderContract = await ethers.getContractFactory(contractName)
    const senderContract = SenderContract.attach(senderAddress)

    // ============================================
    // BATCH CALL CONFIGURATION
    // ============================================

    // Example: Enable multiple fee tiers on Uniswap V3 Factory
    const uniswapV3FactoryAddress = "0xd84f7E85e8A0FA35a945b52593dA39521d7a178f"

    // Define multiple calls
    const calls = [
        {
            target: uniswapV3FactoryAddress,
            value: 0, // No ETH sent
            signature: "enableFeeAmount(uint24,int24)",
            params: {
                types: ["uint24", "int24"],
                values: [501, 10], // 0.05% fee tier with 10 tick spacing
            },
        },
        {
            target: uniswapV3FactoryAddress,
            value: 0,
            signature: "enableFeeAmount(uint24,int24)",
            params: {
                types: ["uint24", "int24"],
                values: [3001, 60], // 0.3% fee tier with 60 tick spacing
            },
        },
        {
            target: uniswapV3FactoryAddress,
            value: 0,
            signature: "enableFeeAmount(uint24,int24)",
            params: {
                types: ["uint24", "int24"],
                values: [10001, 200], // 1% fee tier with 200 tick spacing
            },
        },
    ]

    // ============================================
    // BUILD PAYLOAD
    // ============================================

    console.log("\n=== Building Batch Call Payload ===")
    console.log(`Number of calls in batch: ${calls.length}\n`)

    // Extract arrays from calls configuration
    const targets = []
    const values = []
    const signatures = []
    const calldatas = []

    calls.forEach((call, index) => {
        console.log(`Call ${index + 1}:`)
        console.log(`  Target: ${call.target}`)
        console.log(`  Value: ${call.value} wei`)
        console.log(`  Signature: ${call.signature}`)
        console.log(`  Params: ${JSON.stringify(call.params.values)}`)

        targets.push(call.target)
        values.push(call.value)
        signatures.push(call.signature)

        // Encode parameters for this call
        const encodedParams = ethers.utils.defaultAbiCoder.encode(call.params.types, call.params.values)
        calldatas.push(encodedParams)
        console.log(`  Encoded params: ${encodedParams}\n`)
    })

    // Encode the complete payload
    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )
    console.log("Complete payload:", payload)

    // ============================================
    // ADAPTER PARAMS (GAS CONFIGURATION)
    // ============================================

    // Set gas limit for execution on destination chain
    // Increase this if your batch has many transactions or complex operations
    const gasLimit = 500000 // Adjust based on batch complexity
    const adapterParams = ethers.utils.solidityPack(
        ["uint16", "uint256"],
        [1, gasLimit] // version 1, custom gasLimit
    )
    console.log(`\nAdapter params (gasLimit: ${gasLimit}):`, adapterParams)

    // ============================================
    // ESTIMATE FEES
    // ============================================

    try {
        console.log("\n=== Estimating Fees ===")
        const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
        console.log("Estimated LayerZero fees:")
        console.log(`  Native fee: ${ethers.utils.formatEther(estimatedFee[0])} ETH`)
        console.log(`  ZRO fee: ${estimatedFee[1].toString()}`)

        // ============================================
        // EXECUTE TRANSACTION
        // ============================================

        console.log("\n=== Executing Cross-Chain Batch Transaction ===")
        console.log(`Source contract: ${senderAddress}`)
        console.log(`Destination chain ID: ${remoteChainId}`)
        console.log(`Destination executor: ${executorAddress}`)
        console.log(`Signer: ${signer.address}`)
        console.log(`Batch size: ${calls.length} transactions`)

        // Add 20% buffer to estimated fee for safety
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

        // Check for ExecuteRemoteProposal event (success)
        const executeEvent = receipt.events?.find((e) => e.event === "ExecuteRemoteProposal")
        if (executeEvent) {
            console.log("\n✓ Batch proposal sent successfully to LayerZero!")
            console.log("The transactions will be executed on the destination chain once relayed.")
            console.log("\nNext steps:")
            console.log("1. Monitor the destination chain for execution")
            console.log("2. Check LayerZero scan for message status")
            console.log(`3. Verify each transaction was executed on ${executorAddress}`)
        } else {
            // Check for StorePayload event (if sending failed)
            const storeEvent = receipt.events?.find((e) => e.event === "StorePayload")
            if (storeEvent) {
                console.log("\n⚠ Batch proposal sending failed and was stored for retry")
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
