# Dipper
### Simple Polygon Paraswap stables arbitrage bot.

#### Methodology

Parswap is a swap aggregator with support for polygon network. The logic employed in this bot is that each coin added is roughly the same price. When,for example, 1 USDC can be purchased for less than 1 USDT and the bot is also holding USDT, it will attempt to buy USDC. Later when USDT or DAI is worth less than 1 USDC, the bot will sell the USDC to buy them. This bot is also assisted by aave market to ensure that even while no trades are occuring the capital is still at work. In my experience this bot works to provide oustanding yields for amounts less than $10K USD.  

#### Confirguation

Create a file in the root directory called '.env', generate a private key for the polygon network and put it into the .env file with the rpc provider as follows.

```
PROVIDER_URL='https://polygon-rpc.com/'
PRIVATE_KEY='0xYOUR_KEY'
```

#### Getting started

In order to get started you must manually approve each coin you've selected in paraswap using Metamask. Once you've set your approval for Paraswap to use the bot's erc20 funds, as well as configured all the other parameters, you may start the app with

```
node app.js
```

This will generate a verbose log into the console, as well as append to the pricelog.csv file. The pricelog is used by the chart.html to render a chart of each attempted trade. Once some data has been collected you can open chart.html in a browser to get an idea of price action of the coins you've selected.

![Chart.html](screenshot.png?raw=true "I use Arch btw...")