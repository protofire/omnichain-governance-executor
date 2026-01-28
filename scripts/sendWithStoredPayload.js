/**
 * sendWithStoredPayload.js
 *
 * This script demonstrates the "Payload Stored" mechanism in the OmnichainProposalSender.
 *
 * WHAT IS "PAYLOAD STORED"?
 * When a cross-chain message fails to send (usually due to insufficient fees), the OmnichainProposalSender
 * catches the error and stores the payload parameters with a nonce for later retry.
 *
 * HOW IT WORKS:
 * 1. Call execute() with INSUFFICIENT fees (intentionally underpay)
 * 2. The lzEndpoint.send() fails and throws an error
 * 3. The error is caught and a StorePayload event is emitted
 * 4. The payload hash is stored with a nonce for future retry
 * 5. Later, call retryExecute() with the nonce and SUFFICIENT fees
 *
 * WHY USE THIS PATTERN?
 * - Test the retry mechanism
 * - Handle uncertain fee estimations (pay less initially, top up if needed)
 * - Retry failed transactions due to temporary network issues
 * - Recover from edge cases where estimation was incorrect
 *
 * FLOW:
 * Step 1: Send with low fees → Payload gets stored
 * Step 2: Use retryExecute() → Payload is sent successfully
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
    // BUILD PAYLOAD (Example: enableFeeAmount)
    // ============================================

    const uniswapV3FactoryAddress = "0xd84f7E85e8A0FA35a945b52593dA39521d7a178f"
    const fee = 502
    const tickSpacing = 10

    console.log("\n=== Building Payload ===")
    console.log(`Target: ${uniswapV3FactoryAddress}`)
    console.log(`Function: enableFeeAmount(${fee}, ${tickSpacing})`)

    const targets = [uniswapV3FactoryAddress]
    const values = [0]
    const signatures = ["enableFeeAmount(uint24,int24)"]
    const calldatas = [ethers.utils.defaultAbiCoder.encode(["uint24", "int24"], [fee, tickSpacing])]

    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )

    const adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    // ============================================
    // ESTIMATE FEES
    // ============================================

    try {
        console.log("\n=== Estimating Fees ===")
        const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
        console.log(`Estimated native fee: ${ethers.utils.formatEther(estimatedFee[0])} ETH`)
        console.log(`Estimated ZRO fee: ${estimatedFee[1].toString()}`)

        // ============================================
        // STEP 1: SEND WITH INSUFFICIENT FEES
        // ============================================

        console.log("\n=== STEP 1: Sending with INSUFFICIENT Fees (to trigger Payload Stored) ===")

        // Send only 50% of required fees to intentionally fail
        const insufficientFee = estimatedFee[0].div(3)
        console.log(`Sending with: ${ethers.utils.formatEther(insufficientFee)} ETH (33% of required)`)
        console.log("Expected: Transaction will succeed, but payload will be STORED for retry")
        // Grabbing these params to add into the Tally UI
        console.log("\n============================================")
        console.log(`Remote ID: ${remoteChainId}`)
        console.log(`Payload: ${payload}`)
        console.log(`AdapterParams: ${adapterParams}`)
        console.log("\n============================================")
        // return

        // const tx1 = await senderContract.execute(remoteChainId, payload, adapterParams, {
        //     value: insufficientFee,
        // })
        // console.log(`\nTransaction hash: ${tx1.hash}`)
        // console.log("Waiting for confirmation...")

        // const receipt1 = await tx1.wait()
        // console.log(`✓ Transaction confirmed in block ${receipt1.blockNumber}`)

        // ============================================
        // CHECK FOR STORED PAYLOAD
        // ============================================

        // Check for StorePayload event
        // const storeEvent = receipt1.events?.find((e) => e.event === "StorePayload")

        // if (storeEvent) {
        if (true) {
            // const nonce = storeEvent.args.nonce
            // const storedRemoteChainId = storeEvent.args.remoteChainId
            // const storedPayload = storeEvent.args.payload
            // const storedAdapterParams = storeEvent.args.adapterParams
            // const storedValue = storeEvent.args.value
            // const reason = storeEvent.args.reason

            // Manually fetching this data from tx: https://etherscan.io/tx/0x60e364ef4b18e9f7eb6c1a5a494dd5e0040f2d9eadc2c2e00a0a281884c9679b#eventlog
            const nonce = 1
            const storedRemoteChainId = 396
            const storedPayload =
                "0x000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000C0000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000001000000000000000000000000D84F7E85E8A0FA35A945B52593DA39521D7A178F0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001D656E61626C65466565416D6F756E742875696E7432342C696E7432342900000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001F6000000000000000000000000000000000000000000000000000000000000000A"
            const storedAdapterParams = "0x00010000000000000000000000000000000000000000000000000000000000030D40"
            const storedValue = 0
            const reason =
                "0x08C379A0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000254C617965725A65726F3A206E6F7420656E6F756768206E617469766520666F722066656573000000000000000000000000000000000000000000000000000000"

            console.log("\n✓ PAYLOAD STORED SUCCESSFULLY!")
            console.log("=====================================")
            console.log(`Stored Nonce: ${nonce}`)
            console.log(`Remote Chain ID: ${storedRemoteChainId}`)
            console.log(`Original Value: ${ethers.utils.formatEther(storedValue)} ETH`)
            console.log(`Failure Reason: ${reason}`)
            console.log("=====================================")

            // Query the stored execution hash from the contract
            const storedHash = await senderContract.storedExecutionHashes(nonce)
            console.log(`\nStored execution hash: ${storedHash}`)

            // Verify the hash matches
            const computedExecution = ethers.utils.defaultAbiCoder.encode(
                ["uint16", "bytes", "bytes", "uint256"],
                [storedRemoteChainId, storedPayload, storedAdapterParams, storedValue]
            )
            const computedHash = ethers.utils.keccak256(computedExecution)
            console.log(`Computed hash matches: ${computedHash === storedHash}`)

            // ============================================
            // STEP 2: RETRY WITH SUFFICIENT FEES
            // ============================================

            console.log("\n=== STEP 2: Retrying with SUFFICIENT Fees ===")

            // Calculate additional fees needed
            // We need (originalValue + additionalValue) to equal estimatedFee with buffer
            const feeWithBuffer = estimatedFee[0].mul(120).div(100)
            const additionalFee = feeWithBuffer.sub(storedValue)

            console.log(`Original value: ${ethers.utils.formatEther(storedValue)} ETH`)
            console.log(`Additional fee needed: ${ethers.utils.formatEther(additionalFee)} ETH`)
            console.log(`Total fee: ${ethers.utils.formatEther(feeWithBuffer)} ETH`)

            console.log("\nCalling retryExecute()...")
            const tx2 = await senderContract.retryExecute(nonce, storedRemoteChainId, storedPayload, storedAdapterParams, storedValue, {
                value: additionalFee,
            })
            console.log(`Transaction hash: ${tx2.hash}`)
            console.log("Waiting for confirmation...")

            const receipt2 = await tx2.wait()
            console.log(`\n✓ Retry transaction confirmed in block ${receipt2.blockNumber}`)
            console.log(`Gas used: ${receipt2.gasUsed.toString()}`)

            // Check for ClearPayload event (success)
            const clearEvent = receipt2.events?.find((e) => e.event === "ClearPayload")
            if (clearEvent) {
                console.log("\n✓✓✓ PAYLOAD SENT SUCCESSFULLY! ✓✓✓")
                console.log(`Cleared nonce: ${clearEvent.args.nonce}`)
                console.log(`Execution hash: ${clearEvent.args.executionHash}`)
                console.log("\nThe proposal is now being relayed to the destination chain via LayerZero!")
            }

            // Verify the stored hash was cleared
            const clearedHash = await senderContract.storedExecutionHashes(nonce)
            console.log(`\nStored hash cleared: ${clearedHash === ethers.constants.HashZero}`)

            console.log("\n=== COMPLETE FLOW EXECUTED ===")
            console.log("Summary:")
            console.log("1. ✓ Sent with insufficient fees → Payload stored")
            console.log("2. ✓ Retried with sufficient fees → Payload sent")
            console.log("3. ✓ Stored hash cleared from contract")
        } else {
            // This would happen if fees were actually sufficient
            const executeEvent = receipt1.events?.find((e) => e.event === "ExecuteRemoteProposal")
            if (executeEvent) {
                console.log("\n⚠ UNEXPECTED: Payload was sent successfully on first attempt!")
                console.log("The fees were actually sufficient. To trigger Payload Stored:")
                console.log("- Reduce the insufficientFee further (try 10% or 1% of estimated)")
                console.log("- OR use a very low fixed value like 0.0001 ETH")
            } else {
                console.log("\n⚠ No StorePayload or ExecuteRemoteProposal event found")
                console.log("Check transaction logs for details")
            }
        }
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
