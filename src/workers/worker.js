const { LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');
const { parentPort, workerData } = require('worker_threads');
const { ArbBot, SwapToken } = require('../bots/bot.cjs');
const config = require('../config/config');

const defaultConfig = {
  solanaEndpoint: clusterApiUrl('mainnet-beta'),
  jupiter: 'https://quote-api.jup.ag/v6',
};

async function runWorker() {
  const data = workerData._doc;
  const idString = Buffer.from(workerData._doc._id.id).toString('hex');
  const decodedSecretKey = Uint8Array.from(JSON.parse(data.secretKey));

  const bot = new ArbBot({
    botId: idString,
    firstMintToken: data.firstMintToken,
    secondMintToken: data.secondMintToken,
    solanaEndpoint: config.solana.solanaEndpoint || defaultConfig.solanaEndpoint,
    metisEndpoint: config.solana.metisEndpoint || defaultConfig.jupiter,
    secretKey: decodedSecretKey,
    firstTradePrice: data.firstTradePrice * LAMPORTS_PER_SOL,
    targetGainPercentage: data.targetGainPercentage,
    initialInputToken: SwapToken.TOKEN,
    initialInputAmount: data.initialInputAmount * LAMPORTS_PER_SOL,
  });

  await bot.init();
}

runWorker().catch((err) => {
  // Implement error handling or logging as needed
  parentPort.postMessage({ error: err.message });
});
