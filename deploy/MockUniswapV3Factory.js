module.exports = async function ({ deployments, getNamedAccounts }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`Deployer address: ${deployer}`)
    await deploy("MockUniswapV3Factory", {
        from: deployer,
        log: true,
        waitConfirmations: 1,
    })
}

module.exports.tags = ["MockUniswapV3Factory"]
