const { chain } = require('lodash');
const { hard } = require('wordwrap');

require('@nomicfoundation/hardhat-toolbox');
require("dotenv").config();
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
module.exports = {
  solidity: "0.8.28",
  /*path:{
    sources:"./contracts",
    artifacts:"./artifacts",
    cache:"./cache"
  },
  resolve:{
    alias:{
      "@chainlink":path.resolve(__dirname,"node_modules/@chainlink"),
    }
  },*/
  
  networks: {
    localhost: {
      url: RPC_URL,
      account:[PRIVATE_KEY],
      chainId:31337,
      //url: "http://127.0.0.1:8545"
    }
  }
};
