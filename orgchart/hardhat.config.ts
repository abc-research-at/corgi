import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-web3";
import "hardhat-gas-reporter";

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: {
        count: 30,
      },
    },
  },
  solidity: {
    version: "0.8.17",
  },
  gasReporter: {
    enabled: true,
    coinmarketcap: "e3abe204-56f3-470b-adc2-12bb600af637",
    currency: "EUR",
  },
  paths: {
    tests: "./test",
    sources: "./contracts",
  },
};

export default config;
