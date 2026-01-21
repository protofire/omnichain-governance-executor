const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    // Setup
    const senderAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E"
    const remoteChainId = 396
    const executorAddress = "0x917791cF935260b3BfF6840a84C764C8d8A6352b"
    const contractName = "OmnichainProposalSender"
    const [signer] = await ethers.getSigners()
    const SenderContract = await ethers.getContractFactory(contractName)
    const senderContract = SenderContract.attach(senderAddress)

    // create the calldata
    const fee = 501
    const tickSpacing = 10

    const uniswapV3FactoryInterface = new hre.ethers.utils.Interface(["function enableFeeAmount(uint24 fee, int24 tickSpacing)"])
    enableFeeAmountCallData = uniswapV3FactoryInterface.encodeFunctionData("enableFeeAmount", [fee, tickSpacing])
    console.log("enableFee calldata:", enableFeeAmountCallData)

    // create estimate fee options
    const adapterParams = ethers.utils.solidityPack(
        ["uint16", "uint256"],
        [1, 200000] // version, gasLimit
    )
    console.log("adapter params:", adapterParams)

    // Build the payload for OmnichainGovernanceExecutor
    // The executor expects: abi.encode(targets, values, signatures, calldatas)
    const uniswapV3FactoryAddress = "0xd84f7E85e8A0FA35a945b52593dA39521d7a178f" // Uniswap V3 Factory on destination chain
    const targets = [uniswapV3FactoryAddress]
    const values = [0] // No ETH sent with the call
    const signatures = ["enableFeeAmount(uint24,int24)"] // Function signature
    const calldatas = [ethers.utils.defaultAbiCoder.encode(["uint24", "int24"], [fee, tickSpacing])]

    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )
    console.log("payload:", payload)

    // Estimate fees
    try {
        const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
        console.log("estimated fee:", estimatedFee)
        console.log("  nativeFee:", ethers.utils.formatEther(estimatedFee[0]), "ETH")
        console.log("  zroFee:", estimatedFee[1].toString())

        // Execute the cross-chain transaction
        console.log("\n=== Executing Cross-Chain Transaction ===")
        console.log(`Sending to chain: ${remoteChainId}`)
        console.log(`Executor address: ${executorAddress}`)
        console.log(`Signer: ${signer.address}`)

        // Add 20% buffer to the estimated fee for safety
        const feeWithBuffer = estimatedFee[0].mul(120).div(100)
        console.log(`Fee with buffer: ${ethers.utils.formatEther(feeWithBuffer)} ETH\n`)

        const tx = await senderContract.execute(remoteChainId, payload, adapterParams, {
            value: feeWithBuffer,
        })
        console.log(`Transaction hash: ${tx.hash}`)
        console.log("Waiting for confirmation...")

        const receipt = await tx.wait()
        console.log(`✓ Transaction confirmed in block ${receipt.blockNumber}`)
        console.log(`Gas used: ${receipt.gasUsed.toString()}`)

        // Check for ExecuteRemoteProposal event
        const executeEvent = receipt.events?.find((e) => e.event === "ExecuteRemoteProposal")
        if (executeEvent) {
            console.log("\n✓ Proposal sent successfully!")
        } else {
            // Check for StorePayload event (if sending failed)
            const storeEvent = receipt.events?.find((e) => e.event === "StorePayload")
            if (storeEvent) {
                console.log("\n⚠ Proposal sending failed and was stored for retry")
                console.log(`Nonce: ${storeEvent.args.nonce}`)
                console.log(`Reason: ${storeEvent.args.reason}`)
            }
        }

        console.log("\n=== Execution Complete ===")
    } catch (e) {
        console.error("\n❌ Error:", e.message)
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
