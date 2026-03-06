const { expect } = require("chai")
const { ethers } = require("hardhat")
const { utils } = require("ethers")

describe("OmnichainGovernanceExecution - Uniswap V2 setFeeToSetter", () => {
    const proposalSenderChainId = 1
    const remoteExecutorChainId = 2

    let owner, newFeeToSetter
    let proposalSenderEndpoint, remoteExecutorEndpoint
    let governorBravo, timelock, proposalSender, remoteExecutor
    let v2Factory
    let payload, fee
    let adapterParams = "0x"
    let targets, values, signatures, calldatas
    let proposalId

    before(async () => {
        ;[owner, newFeeToSetter] = await ethers.getSigners()
    })

    beforeEach(async () => {
        // Deploy mock LZ endpoints
        const endpointFactory = await ethers.getContractFactory("LayerZeroEndpoint")
        proposalSenderEndpoint = await endpointFactory.deploy(proposalSenderChainId)
        remoteExecutorEndpoint = await endpointFactory.deploy(remoteExecutorChainId)

        // Deploy governance mocks
        const timelockFactory = await ethers.getContractFactory("TimelockMock")
        timelock = await timelockFactory.deploy()

        const governorBravoFactory = await ethers.getContractFactory("GovernorBravoMock")
        governorBravo = await governorBravoFactory.deploy(timelock.address)

        // Deploy omnichain contracts
        const proposalSenderFactory = await ethers.getContractFactory("OmnichainProposalSender")
        proposalSender = await proposalSenderFactory.deploy(proposalSenderEndpoint.address)

        const remoteExecutorFactory = await ethers.getContractFactory("OmnichainGovernanceExecutor")
        remoteExecutor = await remoteExecutorFactory.deploy(remoteExecutorEndpoint.address)

        // Wire up LZ endpoints
        proposalSenderEndpoint.setDestLzEndpoint(remoteExecutor.address, remoteExecutorEndpoint.address)
        remoteExecutorEndpoint.setDestLzEndpoint(proposalSender.address, proposalSenderEndpoint.address)

        // Set trusted remotes on both sides
        await proposalSender.setTrustedRemoteAddress(remoteExecutorChainId, remoteExecutor.address)
        await remoteExecutor.setTrustedRemoteAddress(proposalSenderChainId, proposalSender.address)

        // Transfer OmnichainProposalSender ownership to Timelock (as in production)
        await proposalSender.transferOwnership(timelock.address)

        // Deploy MockUniswapV2Factory with remoteExecutor as the initial feeToSetter
        // so that the executor is authorized to call setFeeToSetter cross-chain
        const v2FactoryFactory = await ethers.getContractFactory("MockUniswapV2Factory")
        v2Factory = await v2FactoryFactory.deploy(remoteExecutor.address)

        // Build the cross-chain proposal payload targeting setFeeToSetter(address)
        payload = utils.defaultAbiCoder.encode(
            ["address[]", "uint256[]", "string[]", "bytes[]"],
            [
                [v2Factory.address],
                [0],
                ["setFeeToSetter(address)"],
                [utils.defaultAbiCoder.encode(["address"], [newFeeToSetter.address])],
            ]
        )

        // Build the GovernorBravo proposal that calls OmnichainProposalSender.execute()
        targets = [proposalSender.address]
        signatures = ["execute(uint16,bytes,bytes)"]
        calldatas = [utils.defaultAbiCoder.encode(["uint16", "bytes", "bytes"], [remoteExecutorChainId, payload, adapterParams])]

        fee = await proposalSender.estimateFees(remoteExecutorChainId, payload, adapterParams)
    })

    it("executes setFeeToSetter cross-chain and updates feeToSetter on the V2 factory", async () => {
        values = [fee.nativeFee]

        await governorBravo.propose(targets, values, signatures, calldatas)
        proposalId = await governorBravo.proposalCount()

        await governorBravo.execute(proposalId, { value: fee.nativeFee })

        expect(await v2Factory.feeToSetter()).to.eq(newFeeToSetter.address)
    })

    it("sets feeTo and transfers feeToSetter role atomically via a single cross-chain proposal", async () => {
        const feeCollector = owner.address

        // Both actions must be batched in a single payload because after setFeeToSetter
        // the executor is no longer feeToSetter and cannot call setFeeTo in a subsequent proposal.
        // Order matters: setFeeTo first (executor still holds the role), setFeeToSetter second.
        const batchedPayload = utils.defaultAbiCoder.encode(
            ["address[]", "uint256[]", "string[]", "bytes[]"],
            [
                [v2Factory.address, v2Factory.address],
                [0, 0],
                ["setFeeTo(address)", "setFeeToSetter(address)"],
                [
                    utils.defaultAbiCoder.encode(["address"], [feeCollector]),
                    utils.defaultAbiCoder.encode(["address"], [newFeeToSetter.address]),
                ],
            ]
        )

        const batchedFee = await proposalSender.estimateFees(remoteExecutorChainId, batchedPayload, adapterParams)
        const batchedCalldatas = [utils.defaultAbiCoder.encode(["uint16", "bytes", "bytes"], [remoteExecutorChainId, batchedPayload, adapterParams])]

        await governorBravo.propose([proposalSender.address], [batchedFee.nativeFee], ["execute(uint16,bytes,bytes)"], batchedCalldatas)
        proposalId = await governorBravo.proposalCount()
        await governorBravo.execute(proposalId, { value: batchedFee.nativeFee })

        expect(await v2Factory.feeTo()).to.eq(feeCollector)
        expect(await v2Factory.feeToSetter()).to.eq(newFeeToSetter.address)
    })

    it("reverts if a caller other than feeToSetter attempts setFeeToSetter directly", async () => {
        let reverted = false
        try {
            await v2Factory.connect(owner).setFeeToSetter(owner.address)
        } catch (e) {
            reverted = true
            expect(e.message).to.include("UniswapV2: FORBIDDEN")
        }
        expect(reverted).to.be.true
    })
})
