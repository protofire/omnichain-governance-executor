const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    try {
        const contractAddress = "0x917791cF935260b3BfF6840a84C764C8d8A6352b" // Stable
        // const remoteChainId = 396 // Stable
        // const remoteAddress = "0x917791cF935260b3BfF6840a84C764C8d8A6352b" // Stable

        // const contractAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E" // ETH
        const remoteChainId = 101 // ETH
        const remoteAddress = "0x79478Fb7967878e6F65A59a33E7BAB33EF11423E" // ETH

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
