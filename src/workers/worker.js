const { LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');
const config = require('../config/config');
const { ArbBot, SwapToken } = require('../bots/bot.cjs');

const defaultConfig = {
  solanaEndpoint: clusterApiUrl('mainnet-beta'),
  jupiter: 'https://quote-api.jup.ag/v6',
};

async function runWorker(botData) {
  const decodedSecretKey = Uint8Array.from(JSON.parse(botData.secretKey));

  const bot = new ArbBot({
    botId: botData._id,
    firstMintToken: botData.firstMintToken,
    secondMintToken: botData.secondMintToken,
    solanaEndpoint: config.solana.solanaEndpoint || defaultConfig.solanaEndpoint,
    metisEndpoint: config.solana.metisEndpoint || defaultConfig.jupiter,
    secretKey: decodedSecretKey,
    firstTradePrice: botData.firstTradePrice * LAMPORTS_PER_SOL,
    targetGainPercentage: botData.targetGainPercentage,
    initialInputToken: SwapToken.TOKEN,
    initialInputAmount: botData.initialInputAmount * LAMPORTS_PER_SOL,
  });

  await bot.init();
  return { result: 'success' };
}

process.on('message', async (botData) => {
  try {
    const result = await runWorker(botData);
    process.send(result);
  } catch (err) {
    process.send({ error: err.message });
  }
});
