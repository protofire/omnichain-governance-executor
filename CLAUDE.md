# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
yarn

# Compile contracts
yarn compile

# Run all tests
yarn test

# Run a single test file
npx hardhat test test/OmnichainGovernanceExecutor.test.js

# Coverage report
yarn coverage

# Lint (prettier + solhint)
yarn lint

# Format only
yarn prettier
```

### Deployment and Scripts

```bash
# Deploy to a specific network (uses hardhat-deploy)
npx hardhat deploy --network <network>

# Run utility scripts
npx hardhat run scripts/setTrustedRemoteAddress.js --network <network>
npx hardhat run scripts/setConfig.js --network <network>
npx hardhat run scripts/transferOwnership.js --network <network>
npx hardhat run scripts/sendWithStoredPayload.js --network <network>
```

Networks configured: `ethereum`, `avalanche`, `polygon`, `arbitrum`, `optimism`, `fantom`, `stable`, plus testnets (`goerli`, `fuji`, `mumbai`, etc.).

## Architecture

This project implements cross-chain governance using LayerZero messaging. It extends Compound's GovernorBravo to execute governance proposals on remote chains.

### Core Contracts

**`OmnichainProposalSender`** (deployed on Ethereum/main chain)
- Owned by a `Timelock` contract (GovernorBravo's executor)
- Sends encoded proposal actions to remote chains via the LayerZero endpoint
- On send failure (e.g., insufficient fees), stores a hash of the execution params via `storedExecutionHashes[nonce]` and emits `StorePayload`
- `retryExecute()` allows anyone to retry a failed send by providing the original params + additional ETH for fees
- Payload format: `abi.encode(targets[], values[], signatures[], calldatas[])`

**`OmnichainGovernanceExecutor`** (deployed on each remote chain)
- Extends `NonblockingLzApp` — failed messages do NOT block the queue from the source chain
- Owned by itself or a `Timelock` on the remote chain
- On receiving a message, decodes the payload and executes each action via low-level `.call{value}()`
- Failed executions emit `ProposalFailed` and store the message hash in `failedMessages` for retry

### Message Flow

```
GovernorBravo → Timelock.execute() → OmnichainProposalSender.execute()
    → LayerZero Endpoint (source chain)
    → LayerZero Endpoint (destination chain)
    → OmnichainGovernanceExecutor._nonblockingLzReceive()
    → target contracts called directly
```

### Setup Sequence (for new chains)

1. Deploy `OmnichainProposalSender` on main chain (constructor arg: LZ endpoint address)
2. Deploy `OmnichainGovernanceExecutor` on remote chain (constructor arg: LZ endpoint address)
3. Call `setTrustedRemoteAddress` on both contracts pointing to each other
4. Transfer ownership of `OmnichainProposalSender` to `Timelock`
5. Transfer ownership of `OmnichainGovernanceExecutor` to itself or a remote `Timelock`

### Key Dependencies

- `@layerzerolabs/solidity-examples` v0.0.8 — provides `NonblockingLzApp`, `LzApp`, `ExcessivelySafeCall`
- `@openzeppelin/contracts` v4.x — `Ownable`, `ReentrancyGuard`
- `hardhat-deploy` — deployment scripts in `deploy/`

### Environment

Copy `.env.example` to `.env` and set `MNEMONIC` (or `MNEMONIC_<NETWORK>` for per-network mnemonics).

### Deployed Contracts (Uniswap Governance)

| Chain     | Contract                    | Address |
|-----------|-----------------------------|---------|
| Ethereum  | OmnichainProposalSender     | `0x79478Fb7967878e6F65A59a33E7BAB33EF11423E` |
| Avalanche | OmnichainGovernanceExecutor | `0xeb0BCF27D1Fb4b25e708fBB815c421Aeb51eA9fc` |
| Stable    | OmnichainGovernanceExecutor | `0x917791cF935260b3BfF6840a84C764C8d8A6352b` |

LayerZero chain ID for Stable is `396`.
