/**
 * sendSetFeeTo.js
 *
 * Sends a cross-chain governance proposal to call setFeeTo(address) on a
 * Uniswap V2 Factory deployed on the destination chain.
 *
 * ABOUT setFeeTo:
 * Activates protocol fee collection by setting the address that receives fees.
 * Only the current feeToSetter can call this — the OmnichainGovernanceExecutor
 * must hold that role on the destination chain's V2 factory.
 *
 * IMPORTANT — IF YOU ALSO NEED TO TRANSFER THE feeToSetter ROLE:
 * Run this script first and wait for LayerZero to deliver the message before
 * running sendSetFeeToSetter.js. Once the feeToSetter role is transferred, the
 * executor loses authority and cannot call setFeeTo in a subsequent proposal.
 *
 * USAGE:
 *   npx hardhat run scripts/sendSetFeeTo.js --network ethereum
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
const feeCollector = "0x644441829Cf835B5C59bfddBFB2B11Aa1f2Ee198" // Address to receive protocol fees

// ============================================

async function main() {
    if (!v2FactoryAddress) throw new Error("Set v2FactoryAddress")
    if (!feeCollector) throw new Error("Set feeCollector")

    const [signer] = await ethers.getSigners()
    console.log(`\nNetwork: ${hre.network.name} | Signer: ${signer.address}`)

    const SenderContract = await ethers.getContractFactory("OmnichainProposalSender")
    const senderContract = SenderContract.attach(senderAddress)

    const targets = [v2FactoryAddress]
    const values = [0]
    const signatures = ["setFeeTo(address)"]
    const calldatas = [ethers.utils.defaultAbiCoder.encode(["address"], [feeCollector])]

    const payload = ethers.utils.defaultAbiCoder.encode(
        ["address[]", "uint256[]", "string[]", "bytes[]"],
        [targets, values, signatures, calldatas]
    )

    const adapterParams = ethers.utils.solidityPack(["uint16", "uint256"], [1, 200000])

    console.log("\n=== Proposal Parameters ===")
    console.log(`V2 Factory:      ${v2FactoryAddress}`)
    console.log(`Fee collector:   ${feeCollector}`)
    console.log(`Remote Chain ID: ${remoteChainId}`)

    const estimatedFee = await senderContract.estimateFees(remoteChainId, payload, adapterParams)
    const feeWithBuffer = estimatedFee[0].mul(120).div(100)
    console.log(`\nEstimated fee:        ${ethers.utils.formatEther(estimatedFee[0])} ETH`)
    console.log(`Fee with 20% buffer:  ${ethers.utils.formatEther(feeWithBuffer)} ETH`)

    console.log("\nSending cross-chain proposal...")
    console.log(`\nPayload: ${payload}`)
    console.log(`\nParams:  ${adapterParams}`)
    return
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
        console.log(`\nOnce delivered, verify V2Factory.feeTo() equals ${feeCollector}`)
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
