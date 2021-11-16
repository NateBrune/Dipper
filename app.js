const { ParaSwap } = require('paraswap');
const convert = require('ethereum-unit-converter')
const Web3 = require('web3');
require('dotenv').config();
const fs = require('fs')
const { GasPriceOracle } = require('gas-price-oracle');
const options = {
  chainId: 1,
  defaultRpc: 'https://gasstation-mainnet.matic.network/',
  timeout: 10000,
  defaultFallbackGasPrices: {
    instant: 213,
    fast: 22,
    standard: 17,
    low: 11,
  },
};
const oracle = new GasPriceOracle(options);

const PROVIDER_URL = process.env.PROVIDER_URL;
const privateKey = process.env.PRIVATE_KEY;
const network = 137;
const paraSwap = new ParaSwap(network, undefined);
const provider = new Web3.providers.HttpProvider(PROVIDER_URL);
const web3 = new Web3(provider);
const LOOP_INTERVAL = 1000;
const account = web3.eth.accounts.privateKeyToAccount(privateKey);
const walletAddress = account.address;
web3.eth.accounts.wallet.add(account);


// The minimum ABI required to get the ERC20 Token balance
const minABI = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
];

const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'; // USDC Polygon
const usdcContract = new web3.eth.Contract(minABI, USDC);
const USDC_DECIMALS = 6;
var usdcBalance = null;

const USDT = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
const usdtContract = new web3.eth.Contract(minABI, USDT);
const USDT_DECIMALS = 6;
var usdtBalance = null;

const DAI = '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063';
const daiContract = new web3.eth.Contract(minABI, DAI);
const DAI_DECIMALS = 18;
var daiBalance = null;

const PUSD = '0x9aF3b7DC29D3C4B1A5731408B6A9656fA7aC3b72';
const PUSD_DECIMALS = 18;
var pusdBalance = null;

const FRAX = '0x104592a158490a9228070e0a8e5343b499e125d0';
const FRAX_DECIMALS = 18;
var fraxBalance = null;

const MUSD = '0xe840b73e5287865eec17d250bfb1536704b43b21';
const MUSD_DECIMALS = 18;

const UST = '0x692597b009d13c4049a947cab2239b7d6517875f';
const UST_DECIMALS = 18;

const amUSDT = '0x60d55f02a771d515e077c9c2403a1ef324885cec';
const amUSDT_DECIMALS = 6;

const amUSDC = '0x1a13f4ca1d028320a707d99520abfefca3998b7f';
const amUSDC_DECIMALS = 6;

const amDAI = '0x27f8d03b3a2196956ed754badc28d73be8830a6e';
const amDAI_DECIMALS = 18;


var cointable = {};
var reserveAsset = null;
var reserveBalance = -100;
var txFinished = true;
var buys = 0;
var increaseNonce = false;
var nonce = 0;

function appendCoinToArb(address, decimals, symbol) {
  cointable[address] = [decimals, 0, symbol];
}

function addCoins() {
  //appendCoinToArb(USDT, USDT_DECIMALS, 'USDT');
  //appendCoinToArb(USDC, USDC_DECIMALS, 'USDC');
  //appendCoinToArb(DAI,  DAI_DECIMALS, 'DAI');
  //appendCoinToArb(UST, UST_DECIMALS, 'UST');
  //appendCoinToArb(FRAX, FRAX_DECIMALS, 'FRAX');
  appendCoinToArb(amUSDT, amUSDT_DECIMALS, 'amUSDT');
  appendCoinToArb(amUSDC, amUSDC_DECIMALS, 'amUSDC');
  appendCoinToArb(amDAI, amDAI_DECIMALS, 'amDAI');
  //appendCoinToArb(PUSD, PUSD_DECIMALS, 'PUSD');
  //appendCoinToArb(MUSD, MUSD_DECIMALS, 'MUSD');
}

async function start() {
  addCoins();
  var coins = await getAllBalances();
  //appendCoinToArb(PUSD, PUSD_DECIMALS, 'PUSD');
  console.log(coins);
  nonce = await web3.eth.getTransactionCount(walletAddress);
  loop();
}

async function getAllBalances() {
  for (const [key, value] of Object.entries(cointable)) {
    try{
      var contract = new web3.eth.Contract(minABI, key);
      var balance = await contract.methods.balanceOf(walletAddress).call();
      if(cointable[key][0] == 6){
        cointable[key][1] = balance - 10**3;
      } else {
        var bal =  balance - (10 ** 9);
        var rounded = bal.toLocaleString('fullwide', { useGrouping: false });
        cointable[key][1] = rounded;
      }
    } catch(e){
      console.log(`error: Failed to fetch balance of ${key}`);
      return null;
    }
  }
  return cointable;
}

async function getRate(reserve, reserveSupply, reserveDecimals, ticker, tickerDecimals){
  try{
    const priceRoute = await paraSwap.getRate(
      reserve,
      ticker,
      reserveSupply,
      walletAddress, //Change
      'SELL', // Could not get buy side working
      {},
      reserveDecimals,
      tickerDecimals
    );
    if(priceRoute.hasOwnProperty('hmac')){
      return priceRoute;
    } else {
      console.log(priceRoute);
      return null;
    }
    
  } catch(e){
    console.log(`error: ${e}`);
  }
}

async function buyCoinCallback(err, transactionHash ){
  if (err) {
    console.log(`Logged error: ${err}`);
    if(err == 'Error: Returned error: replacement transaction underpriced'){
      increaseNonce=true;
      buys = buys+100;
    }
    //return this.setState({ error: err.toString(), loading: false });
    return;
  }
  console.log(`transactionHash: ${transactionHash}`);
  txFinished = true;
}

async function buyCoin(srcCoin, srcamt, destCoin, destamt, priceRoute, slippage){
  /*
  if(!txFinished){
    console.log(`txfinished: ${txFinished}`);
    return null
  }
  */
  const destamtWithSlippage = Math.floor(destamt * (1-slippage));
  const txParams = await paraSwap.buildTx(
    srcCoin, //srcToken,
    destCoin, //destToken,
    srcamt, //srcAmount,
    destamtWithSlippage,//destAmount,
    priceRoute, //priceRoute,
    walletAddress, //senderAddress,
    'capitalisnn',//referrer,
    walletAddress //reciever
  );
  //console.log(`gasprice trippled: ${txParams.gasPrice * 4}`);
  buys = buys + 1;
  gas = instantGasPrice; //213500000000
  if((txParams.gasPrice*4)<gas){
    txParams.gasPrice = gas;
  } else {
    txParams.gasPrice = txParams.gasPrice*4;
  }
  
  if(increaseNonce){
    increaseNonce = false;
    
    nonce = await web3.eth.getTransactionCount(walletAddress);
    nonce = nonce;
    txParams['nonce'] = nonce;
  }
  console.log('txParams:');
  console.log(txParams);
  console.log('cointable:');
  console.log(cointable);
  try{
    var txResult = web3.eth.sendTransaction(txParams, buyCoinCallback);
    txFinished = false;
    return txResult;
  } catch (e) {
    console.log(`SELL reverted reason: ${e}`);
    console.log(priceRoute); // debug
    return null
  }
}

async function buyCheap(reserveAsset, reserveBalance) {
  if(cointable[reserveAsset][2] == undefined){
    return;
  }
  for (const [key, value] of Object.entries(cointable)) {
    if(key == reserveAsset){
      continue;
    }
    try{
      var rate = await getRate(reserveAsset, reserveBalance, cointable[reserveAsset][0], key, cointable[key][0]);
      const spent = rate.srcAmount / (10**cointable[reserveAsset][0]);
      const bought = rate.destAmount / (10**cointable[key][0]);
      const price = bought/spent; // We want more bought than spent
      var currentdate = new Date();
      var datetime = currentdate.getDate() + "/"
                    + (currentdate.getMonth()+1)  + "/" 
                    + currentdate.getFullYear() + " @ "  
                    + currentdate.getHours() + ":"  
                    + currentdate.getMinutes() + ":" 
                    + currentdate.getSeconds();

      console.log(`${datetime}| Calculated ${cointable[reserveAsset][2]}/${cointable[key][2]} price ${price}`);
      var target = 1.00002;
      if(price > target){
        var profitMargin = price - target;
        var slippage = profitMargin * 0.95;
        console.log(`SELL @ ${price}`);
        console.log(`slippage tolerance: ${slippage}`);
        var result = buyCoin(rate.srcToken, rate.srcAmount, rate.destToken, rate.destAmount, rate, slippage);
        const checkIfItsDone = async () => {
          result
            .then(ok => {})
            .catch(err => {
              console.log(err);
            })
        }
        checkIfItsDone();
      }
      var content = `${Math.floor(currentdate.getTime()/1000)},${target},TARGET\n${Math.floor(currentdate.getTime()/1000)},${price},${cointable[reserveAsset][2]}/${cointable[key][2]}\n`;
      fs.appendFile(`pricelog.csv`, content, err => {
        if (err) {
          console.error(err)
          return
        }
        //done!
      })
    } catch(e) {
      console.log(`failed to get ${cointable[reserveAsset][2]}/${cointable[key][2]} price`)
      console.log(e);
    }
  }
}

var instantGasPrice = 0;
async function getGasPrice(){
  var gasPrices = await oracle.gasPrices();
  var instant = gasPrices['instant'];
  var propriataryGasPrice = instant + 40 + 1.337;
  instantGasPrice = convert(propriataryGasPrice, 'gwei', 'wei');
  return propriataryGasPrice;
}

async function loop() {
  /*
  if(!txFinished){
    setTimeout(loop, 2000);
    return;
  }
  */
 getGasPrice();
  try{
    var coins = await getAllBalances();
    if(coins == null){
      throw(`couldn't fetch balances`);
    }
    for (const [key, value] of Object.entries(coins)) {
      var bal = parseInt(value[1]);
      if(cointable[key][0] == 18 ){
        bal = convert(bal, 'wei', 'ether');
      }
      if(cointable[key][0] == 6){
        bal = convert(bal, 'szabo', 'ether');
      }

      var resBal = 0;
      
      if(reserveAsset != undefined && cointable[reserveAsset][0] == 18){
        resBal = convert(reserveBalance, 'wei', 'ether');
      }
      if(reserveAsset != undefined && cointable[reserveAsset][0] == 6){
        resBal = convert(reserveBalance, 'szabo', 'ether');
      }

      if(bal > resBal) {
        if(value[1] < 0){
          break;
        }
        reserveAsset = key;
        reserveBalance = value[1];
        console.log(`Reserve:  ${cointable[key][2]} Balalance: ${value[1]}`);
      }
    }

    if(reserveAsset == undefined|| reserveBalance == undefined || cointable[reserveAsset][2] == undefined || reserveBalance <= (10**7)){
      console.log(`error: Reserve asset balance low! ${reserveBalance}`);
      console.log(cointable)
      setTimeout(loop, 500);
      return;
    }

    await buyCheap(reserveAsset, reserveBalance);
  } catch(e) {
    console.log(e);
    console.log(cointable);
    await getAllBalances();
  }
  setTimeout(loop, 500);
  return;
}
start();
