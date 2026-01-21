const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    // Setup

    // Eth
    // const address = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E"
    // const contractName = "OmnichainProposalSender"

    // Stable
    const address = "0x917791cF935260b3BfF6840a84C764C8d8A6352b"
    const contractName = "OmnichainGovernanceExecutor"

    const dstChainId = 396
    const [signer] = await ethers.getSigners()
    const Contract = await ethers.getContractFactory(contractName)
    const contract = Contract.attach(address)

    // LayerZero messaging library version (typically 2 for LayerZero v1 endpoint)
    const LZ_VERSION = 2

    // Config Types (as defined by LayerZero)
    const CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION = 1
    const CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS = 2
    const CONFIG_TYPE_RELAYER = 3
    const CONFIG_TYPE_OUTBOUND_PROOF_TYPE = 4
    const CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS = 5
    const CONFIG_TYPE_ORACLE = 6

    // Config options - All must use defaultAbiCoder.encode to match UltraLightNodeV2's abi.decode expectations
    const libVersionConfig = ethers.utils.defaultAbiCoder.encode(["uint16"], [2]) // Library version 2
    const inbBlockConfConfig = ethers.utils.defaultAbiCoder.encode(["uint64"], [15]) // 15 block confirmations (uint64)
    // const relayerConfig = ethers.utils.defaultAbiCoder.encode(["address"], ["0x902F09715B6303d4173037652FA7377e5b98089E"]) // LZ Relay v2 address on Eth
    const relayerConfig = ethers.utils.defaultAbiCoder.encode(["address"], ["0x5B19bd330A84c049b62D5B0FC2bA120217a18C1C"]) // LZ Relay v2 address on Stable
    const outBoundProofConfig = ethers.utils.defaultAbiCoder.encode(["uint16"], [2]) // Proof type 2 (Ultra Light Node)
    const outbBlockConfConfig = ethers.utils.defaultAbiCoder.encode(["uint64"], [15]) // 15 block confirmations (uint64)
    // const oracleConfig = ethers.utils.defaultAbiCoder.encode(["address"], ["0x589dedbd617e0cbcb916a9223f4d1300c294236b"]) // LZ Oracle address on Eth
    const oracleConfig = ethers.utils.defaultAbiCoder.encode(["address"], ["0x9c061c9a4782294eef65ef28cb88233a987f4bdd"]) // LZ Oracle address on Stable

    // Execute config transactions sequentially
    console.log("\n=== Starting LayerZero Configuration ===")
    console.log(`Contract: ${contractName} at ${address}`)
    console.log(`Destination Chain ID: ${dstChainId}`)
    console.log(`Signer: ${signer.address}\n`)

    try {
        // 1. Set Inbound Proof Library Version
        // console.log("1. Setting Inbound Proof Library Version...")
        // let tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION, libVersionConfig)
        // console.log(`   Transaction hash: ${tx.hash}`)
        // await tx.wait()
        // console.log("   ✓ Confirmed\n")

        // // 2. Set Inbound Block Confirmations
        // console.log("2. Setting Inbound Block Confirmations...")
        // tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS, inbBlockConfConfig)
        // console.log(`   Transaction hash: ${tx.hash}`)
        // await tx.wait()
        // console.log("   ✓ Confirmed\n")

        // // 3. Set Relayer
        console.log("3. Setting Relayer...")
        tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_RELAYER, relayerConfig)
        console.log(`   Transaction hash: ${tx.hash}`)
        await tx.wait()
        console.log("   ✓ Confirmed\n")

        // 4. Set Outbound Proof Type
        // console.log("4. Setting Outbound Proof Type...")
        // tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_OUTBOUND_PROOF_TYPE, outBoundProofConfig)
        // console.log(`   Transaction hash: ${tx.hash}`)
        // await tx.wait()
        // console.log("   ✓ Confirmed\n")

        // // 5. Set Outbound Block Confirmations
        // console.log("5. Setting Outbound Block Confirmations...")
        // tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS, outbBlockConfConfig)
        // console.log(`   Transaction hash: ${tx.hash}`)
        // await tx.wait()
        // console.log("   ✓ Confirmed\n")

        // 6. Set Oracle
        console.log("6. Setting Oracle...")
        tx = await contract.setConfig(LZ_VERSION, dstChainId, CONFIG_TYPE_ORACLE, oracleConfig)
        console.log(`   Transaction hash: ${tx.hash}`)
        await tx.wait()
        console.log("   ✓ Confirmed\n")

        console.log("=== Configuration Complete ===\n")
    } catch (error) {
        console.error("\n❌ Error during configuration:", error.message)
        throw error
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
