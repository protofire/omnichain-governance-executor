const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    try {
        // const contractAddress = "0x505556e173fCDFC0f40e489F341d544C90ac6e6D" // Stable
        const remoteChainId = 396 // Stable
        const remoteAddress = "0x505556e173fCDFC0f40e489F341d544C90ac6e6D" // Stable

        const contractAddress = "0x079fbb55a84f68601A15684e6677Ac078C127e75" // ETH
        // const remoteChainId = 101 // ETH
        // const remoteAddress = "0x079fbb55a84f68601A15684e6677Ac078C127e75" // ETH

        const contractName = "OmnichainGovernanceExecutor"
        // const contractName = "OmnichainProposalSender"

        const [signer] = await ethers.getSigners()

        console.log(`\nSetting trusted remote on ${contractName} at ${contractAddress}`)
        console.log(`Network: ${hre.network.name} | Signer: ${signer.address}`)

        const Contract = await ethers.getContractFactory(contractName)
        const contract = Contract.attach(contractAddress)

        try {
            const currentTrustedRemote = await contract.trustedRemoteLookup(remoteChainId)
            if (currentTrustedRemote && currentTrustedRemote !== "0x") {
                console.log(`⚠️ Overwriting existing trusted remote for chain ${remoteChainId}`)
            }
        } catch (e) {}

        const remoteAddressBytes = ethers.utils.arrayify(remoteAddress)
        console.log(`Setting chain ${remoteChainId} -> ${remoteAddress}`)

        const tx = await contract.setTrustedRemoteAddress(remoteChainId, remoteAddressBytes)
        console.log(`Transaction: ${tx.hash}`)

        const receipt = await tx.wait()
        const trustedRemote = await contract.trustedRemoteLookup(remoteChainId)

        console.log(`✅ Success! (Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed})`)
        console.log(`Trusted remote path: ${trustedRemote}\n`)
    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`)
        if (error.reason) {
            console.error(`Reason: ${error.reason}`)
        }
        process.exit(1)
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
