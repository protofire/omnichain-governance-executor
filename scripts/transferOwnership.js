const hre = require("hardhat")
const { ethers } = require("hardhat")

async function main() {
    try {
        const contractAddress = "0x079fbb55a84f68601A15684e6677Ac078C127e75"
        const contractName = "OmnichainProposalSender"
        const newOwner = "0x1a9C8182C09F50C8318d769245beA52c32BE35BC" // Uniswap Timelock V2

        const [signer] = await ethers.getSigners()

        console.log(`\nTransferring ownership of ${contractName} at ${contractAddress}`)
        console.log(`Network: ${hre.network.name} | Signer: ${signer.address}`)

        const Contract = await ethers.getContractFactory(contractName)
        const contract = Contract.attach(contractAddress)

        const currentOwner = await contract.owner()

        if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
            console.error(`❌ Error: Signer is not the owner (${currentOwner})`)
            process.exit(1)
        }

        if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
            console.warn(`⚠️ Warning: New owner is the same as current owner`)
        }

        const tx = await contract.transferOwnership(newOwner)
        console.log(`Transaction: ${tx.hash}`)

        const receipt = await tx.wait()
        const verifiedOwner = await contract.owner()

        if (verifiedOwner.toLowerCase() === newOwner.toLowerCase()) {
            console.log(`✅ Success! (Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed})`)
            console.log(`New owner: ${verifiedOwner}\n`)
        } else {
            console.error(`❌ Verification failed: Expected ${newOwner}, got ${verifiedOwner}`)
            process.exit(1)
        }
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
