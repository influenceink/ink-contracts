# ink-contracts

Solidity contracts based on `ERC20`, `ERC721`. `Presale`, `Vesting` and
`Staking` contracts for ERC20 token.

## Structure

```bash
   ├─ .github
   ├─ .vscode
   ├─ contracts                                   # solidity contracts
   ├─ scripts                                     # deploy scripts
   |  └─ deploymentParams                         # parameters for contract deployment
   ├─ test                                        # test scripts
   ├─ .env
   ├─ .gitignore
   ├─ .npmignore
   ├─ .prettierignore
   ├─ .prettierrc
   ├─ .solhint.json
   ├─ .solhitignore
   ├─ hardhat.config.ts
   ├─ package.json
   ├─ README.md
   ├─ tsconfig.json
   └─ yarn.lock
```

## Install

1. Clone Repo:

> git clone https://github.com/influenceink/ink-contracts

2. Install node modules:

> yarn

## Set Configuration

To try out deployment or verification, you first need to set configuration.

In this project, copy the .env.example file to a file named .env, and then
edit it to fill in the details. Enter your Etherscan API key, your network
node URL (eg from Alchemy), and the private key of the account which will
send the deployment transaction. With a valid .env file in place, first
deploy your contract:

Example:

```bash
ETHERSCAN_API_KEY=ABC123ABC123ABC123ABC123ABC123ABC1
MAINNET_RPC=https://polygon-mainnet.g.alchemy.com/v2/zcNIdlPU5Vn-2U0uQpfi0AZf11F4rrV5
MUMBAI_RPC=https://polygon-mumbai.g.alchemy.com/v2/zcNIdlPU5Vn-2U0uQpfi0AZf11F4rrV5
PRIVATE_KEY=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1
```

## Deploy Contracts

1.  INK contract

```shell
yarn deploy-ink:mainnet
yarn deploy-ink:mumbai
```

2.  INKNFT contract

```shell
yarn deploy-inknft:mainnet
yarn deploy-inknft:mumbai
```

3.  Presale contract

- For ERC20:

  ```shell
  yarn deploy-presale-erc20:mainnet
  yarn deploy-presale-erc20:mumbai
  ```

- For ETH:

  ```shell
  yarn deploy-presale-eth:mainnet
  yarn deploy-presale-eth:mumbai
  ```

4. Vesting contract

```shell
yarn deploy-vesting:mainnet
yarn deploy-vesting:mumbai
```

5. StakingINK contract

```shell
yarn deploy-staking-ink:mainnet
yarn deploy-staking-ink:mumbai
```

# Verification

Then, copy the deployment address and network name, then paste it in to
replace `DEPLOYED_CONTRACT_ADDRESS` and `NETWORK` in this command:

```shell
yarn verify:NETWORK DEPLOYED_CONTRACT_ADDRESS
```

`NETWORK` can be `mainnet` or `mumbai`.

EXAMPLE:

```shell
yarn verify:mainnet 0xABC123ABC123ABC123ABC123ABC123ABC1
```

## Test

```shell
yarn test
```
