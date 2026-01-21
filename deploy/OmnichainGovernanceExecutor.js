module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments

    const { deployer } = await getNamedAccounts()
    console.log(`Deployer address: ${deployer}`)

    const lzEndpointAddress = "0xb6319cC6c8c27A8F5dAF0dD3DF91EA35C4720dd7" // Stable Endpoint V1
    console.log(`[${hre.network.name}] Endpoint Address: ${lzEndpointAddress}`)

    await deploy("OmnichainGovernanceExecutor", {
        from: deployer,
        args: [lzEndpointAddress],
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["OmnichainGovernanceExecutor"]
