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
   ├─ .eslintignore
   ├─ .eslintrc.js
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

> npm install

Or

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
ROPSTEN_URL=https://eth-ropsten.alchemyapi.io/v2/<YOUR ALCHEMY KEY>
PRIVATE_KEY=0xabc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abc1
```

## Deploy Contracts

Replace `CONTRACT` and `NETWORK` in this command:

> yarn deploy-CONTRACT:NETWORK

Example:

```shell
yarn deploy-ink:polygon
```

# Verification

Then, copy the deployment address and network name, then paste it in to
replace `DEPLOYED_CONTRACT_ADDRESS` and `NETWORK` in this command:

```shell
yarn verify:NETWORK DEPLOYED_CONTRACT_ADDRESS
```

EXAMPLE:

```shell
yarn verify:polygon 0xABC123ABC123ABC123ABC123ABC123ABC1
```

## Test

```shell
npm run test
```

Or

```shell
yarn test
```
