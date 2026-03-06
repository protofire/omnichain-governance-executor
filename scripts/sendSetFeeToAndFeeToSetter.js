/**
 * sendSetFeeToAndFeeToSetter.js
 *
 * Sends a single cross-chain governance proposal that atomically calls both
 * setFeeTo(address) and setFeeToSetter(address) on a Uniswap V2 Factory
 * deployed on the destination chain.
 *
 * Use this script instead of running sendSetFeeTo.js and sendSetFeeToSetter.js
 * separately when both actions are needed, saving one cross-chain message and
 * avoiding the wait for LayerZero delivery between the two proposals.
 *
 * EXECUTION ORDER IN PAYLOAD (order matters):
 *   [0] setFeeTo(feeCollector)         — executor is still feeToSetter ✓
 *   [1] setFeeToSetter(newFeeToSetter) — executor transfers the role   ✓
 *
 * USAGE:
 *   npx hardhat run scripts/sendSetFeeToAndFeeToSetter.js --network ethereum
 *
 * PREREQUISITES:
 *   - OmnichainGovernanceExecutor is the current feeToSetter on the V2 factory
 *   - OmnichainProposalSender trusted remote is configured for the destination chain
 */

const hre = require("hardhat")
const { ethers } = require("hardhat")

// ============================================
// CONFIGURATION — update before running
// ============================================

const senderAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E" // OmnichainProposalSender on Ethereum
const remoteChainId = 396 // Stable LZ chain ID

const v2FactoryAddress = "0xD77B60EDf9E409e403447Bd6C3ce75BaF99A2176" // UniswapV2Factory on the destination chain
const feeCollector = "" // Address to receive protocol fees
const newFeeToSetter = "0x917791cF935260b3BfF6840a84C764C8d8A6352b" // Address to receive the feeToSetter role

// ============================================

async function main() {
    if (!v2FactoryAddress) throw new Error("Set v2FactoryAddress")
    if (!feeCollector) throw new Error("Set feeCollector")
    if (!newFeeToSetter) throw new Error("Set newFeeToSetter")

    const [signer] = await ethers.getSigners()
    console.log(`\nNetwork: ${hre.network.name} | Signer: ${signer.address}`)

    const SenderContract = await ethers.getContractFactory("OmnichainProposalSender")
    const senderContract = SenderContract.attach(senderAddress)

    const targets = [v2FactoryAddress, v2FactoryAddress]
    const values = [0, 0]
    const signatures = ["setFeeTo(address)", "setFeeToSetter(address)"]
    const calldatas = [
        ethers.utils.defaultAbiCoder.encode(["address"], [feeCollector]),
        ethers.utils.defaultAbiCoder.encode(["address"], [newFeeToSetter]),
    ]

    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )

    const adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    console.log("\n=== Proposal Actions ===")
    console.log(`[0] setFeeTo(${feeCollector})`)
    console.log(`[1] setFeeToSetter(${newFeeToSetter})`)
    console.log(`\nV2 Factory:      ${v2FactoryAddress}`)
    console.log(`Remote Chain ID: ${remoteChainId}`)
    console.log(`\nPayload: ${payload}`)
    console.log(`Params:  ${adapterParams}`)

    const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
    const feeWithBuffer = estimatedFee[0].mul(120).div(100)
    console.log(`\nEstimated fee:        ${ethers.utils.formatEther(estimatedFee[0])} ETH`)
    console.log(`Fee with 20% buffer:  ${ethers.utils.formatEther(feeWithBuffer)} ETH`)

    console.log("\nSending cross-chain proposal...")
    const tx = await senderContract.execute(remoteChainId, payload, adapterParams, {
        value: feeWithBuffer,
    })
    console.log(`Transaction hash: ${tx.hash}`)

    const receipt = await tx.wait()
    console.log(`Confirmed in block ${receipt.blockNumber} (gas used: ${receipt.gasUsed})`)

    const executeEvent = receipt.events?.find((e) => e.event === "ExecuteRemoteProposal")
    const storeEvent = receipt.events?.find((e) => e.event === "StorePayload")

    if (executeEvent) {
        console.log("\nProposal sent successfully.")
        console.log(`Monitor delivery: https://layerzeroscan.com/tx/${tx.hash}`)
        console.log("\nOnce delivered, verify on the destination chain:")
        console.log(`  V2Factory.feeTo()       should equal ${feeCollector}`)
        console.log(`  V2Factory.feeToSetter() should equal ${newFeeToSetter}`)
    } else if (storeEvent) {
        console.log("\nSending failed — payload stored for retry.")
        console.log(`Nonce: ${storeEvent.args.nonce}`)
        console.log(`Reason: ${storeEvent.args.reason}`)
        console.log("Run sendWithStoredPayload.js to retry with sufficient fees.")
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(`\n❌ Error: ${error.message}`)
        if (error.reason) console.error(`Reason: ${error.reason}`)
        process.exit(1)
    })
