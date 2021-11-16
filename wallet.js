const Web3 = require('web3');
require('dotenv').config();
const PROVIDER_URL = process.env.PROVIDER_URL;
var web3 = new Web3(new Web3.providers.HttpProvider(PROVIDER_URL));
var account = web3.eth.accounts.create();
console.log(account);