const {
  Keypair,
  Connection,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  AddressLookupTableAccount,
  TransactionMessage,
} = require('@solana/web3.js');
const { createJupiterApiClient, ResponseError } = require('@jup-ag/api');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Log = require('../models/log.model');
const config = require('../config/config');
const logger = require('../config/logger');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

let SwapToken;
// eslint-disable-next-line no-shadow
(function (SwapToken) {
  // eslint-disable-next-line no-param-reassign
  SwapToken[(SwapToken.SOL = 0)] = 'SOL';
  // eslint-disable-next-line no-param-reassign
  SwapToken[(SwapToken.TOKEN = 1)] = 'TOKEN';
})(SwapToken || (SwapToken = {}));

/**
 * Calculates the associated token address for a given owner and token mint.
 *
 * @param {PublicKey} ownerPublicKey - The public key of the token account owner.
 * @param {PublicKey} mintPublicKey - The public key of the token mint.
 * @returns {Promise<PublicKey>} - The associated token address.
 */
function getAssociatedTokenAddressSync(ownerPublicKey, mintPublicKey) {
  const [address] = PublicKey.findProgramAddressSync(
    [ownerPublicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPublicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  return address;
}

mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
});

class ArbBot {
  constructor(configData) {
    const {
      solanaEndpoint,
      secretKey,
      targetGainPercentage,
      checkInterval,
      initialInputToken,
      initialInputAmount,
      firstTradePrice,
      firstMintToken,
      secondMintToken,
      botId,
    } = configData;
    this.tokenMint = new PublicKey(firstMintToken);
    this.solMint = new PublicKey(secondMintToken);
    this.solBalance = 0;
    this.tokenBalance = 0;
    this.checkInterval = 1000 * 10;
    this.lastCheck = 0;
    this.targetGainPercentage = 1;
    this.waitingForConfirmation = false;
    this.botId = botId;
    this.solanaConnection = new Connection(solanaEndpoint, 'confirmed');
    this.jupiterApi = createJupiterApiClient();
    this.wallet = Keypair.fromSecretKey(secretKey);
    this.tokenTokenAccount = getAssociatedTokenAddressSync(this.wallet.publicKey, this.tokenMint);
    if (targetGainPercentage) {
      this.targetGainPercentage = targetGainPercentage;
    }
    if (checkInterval) {
      this.checkInterval = checkInterval;
    }
    this.nextTrade = {
      inputMint: initialInputToken === SwapToken.SOL ? this.solMint.toBase58() : this.tokenMint.toBase58(),
      outputMint: initialInputToken === SwapToken.SOL ? this.tokenMint.toBase58() : this.solMint.toBase58(),
      amount: initialInputAmount,
      nextTradeThreshold: firstTradePrice,
    };
  }

  static logDataToDatabase(level, message, metadata, botId) {
    Log.create({
      level,
      message,
      metadata,
      bot: botId,
    })
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('Log saved successfully');
      })
      .catch((err) => {
        throw new Error(`Error writing log: ${err}`);
      });
  }

  async init() {
    ArbBot.logDataToDatabase(
      'info',
      `🤖 Initiating arb bot for wallet: ${this.wallet.publicKey.toBase58()}.`,
      { logFunc: 'init' },
      this.botId
    );
    await this.refreshBalances();
    ArbBot.logDataToDatabase(
      'info',
      `🏦 Current balances:\nSOL: ${this.solBalance / LAMPORTS_PER_SOL},\nPEPEFAN: ${this.tokenBalance}`,
      { logFunc: 'init' },
      this.botId
    );
    this.initiatePriceWatch();
  }

  async refreshBalances() {
    try {
      const results = await Promise.allSettled([
        this.solanaConnection.getBalance(this.wallet.publicKey),
        this.solanaConnection.getTokenAccountBalance(this.tokenTokenAccount),
      ]);

      const solBalanceResult = results[0];
      const tokenBalanceResult = results[1];

      if (solBalanceResult.status === 'fulfilled') {
        this.solBalance = solBalanceResult.value;
      } else {
        ArbBot.logDataToDatabase(
          'error',
          `Error fetching SOL balance: ${solBalanceResult.reason}`,
          { logFunc: 'refreshBalances' },
          this.botId
        );
      }

      if (tokenBalanceResult.status === 'fulfilled') {
        this.tokenBalance = tokenBalanceResult.value.value.uiAmount || 0;
      } else {
        this.tokenBalance = 0;
      }

      if (this.solBalance < LAMPORTS_PER_SOL / 100) {
        this.terminateSession('Low SOL balance.');
      }
    } catch (error) {
      ArbBot.logDataToDatabase(
        'error',
        `Unexpected error during balance refresh: ${error}`,
        { logFunc: 'refreshBalances' },
        this.botId
      );
    }
  }

  initiatePriceWatch() {
    this.priceWatchIntervalId = setInterval(async () => {
      const currentTime = Date.now();
      if (currentTime - this.lastCheck >= this.checkInterval) {
        this.lastCheck = currentTime;
        try {
          if (this.waitingForConfirmation) {
            ArbBot.logDataToDatabase(
              'info',
              'Waiting for previous transaction to confirm...',
              { logFunc: 'initiatePriceWatch' },
              this.botId
            );
            return;
          }
          const quote = await this.getQuote(this.nextTrade);
          this.evaluateQuoteAndSwap(quote);
        } catch (error) {
          ArbBot.logDataToDatabase('error', `Error getting quote: ${error}`, { logFunc: 'initiatePriceWatch' }, this.botId);
        }
      }
    }, this.checkInterval);
  }

  async getQuote(quoteRequest) {
    try {
      const quote = await this.jupiterApi.quoteGet(quoteRequest);
      if (!quote) {
        throw new Error('No quote found');
      }
      return quote;
    } catch (error) {
      if (error instanceof ResponseError) {
        ArbBot.logDataToDatabase('info', await error.response.json(), { logFunc: 'getQuote' }, this.botId);
      } else {
        ArbBot.logDataToDatabase('error', error, { logFunc: 'getQuote' }, this.botId);
      }
      throw new Error('Unable to find quote');
    }
  }

  async evaluateQuoteAndSwap(quote) {
    const difference =
      (parseInt(quote.outAmount, 10) - this.nextTrade.nextTradeThreshold) / this.nextTrade.nextTradeThreshold;
    ArbBot.logDataToDatabase(
      'info',
      `📈 Current price: ${quote.outAmount} is ${difference > 0 ? 'higher' : 'lower'} than the next trade threshold: ${
        this.nextTrade.nextTradeThreshold
      } by ${Math.abs(difference * 100).toFixed(2)}%.`,
      { logFunc: 'evaluateQuoteAndSwap' },
      this.botId
    );
    if (parseInt(quote.outAmount, 10) > this.nextTrade.nextTradeThreshold) {
      try {
        this.waitingForConfirmation = true;
        await this.executeSwap(quote);
      } catch (error) {
        ArbBot.logDataToDatabase('error', `Error executing swap: ${error}`, { logFunc: 'evaluateQuoteAndSwap' }, this.botId);
      }
    }
  }

  async executeSwap(route) {
    try {
      const {
        computeBudgetInstructions,
        setupInstructions,
        swapInstruction,
        cleanupInstruction,
        addressLookupTableAddresses,
      } = await this.jupiterApi.swapInstructionsPost({
        swapRequest: {
          quoteResponse: route,
          userPublicKey: this.wallet.publicKey.toBase58(),
          prioritizationFeeLamports: 'auto',
        },
      });

      const instructions = [
        ...computeBudgetInstructions.map(this.instructionDataToTransactionInstruction),
        ...setupInstructions.map(this.instructionDataToTransactionInstruction),
        this.instructionDataToTransactionInstruction(swapInstruction),
        this.instructionDataToTransactionInstruction(cleanupInstruction),
      ].filter((ix) => ix !== null);

      const addressLookupTableAccounts = await this.getAdressLookupTableAccounts(
        addressLookupTableAddresses,
        this.solanaConnection
      );

      const { blockhash, lastValidBlockHeight } = await this.solanaConnection.getLatestBlockhash();

      const messageV0 = new TransactionMessage({
        payerKey: this.wallet.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message(addressLookupTableAccounts);

      const transaction = new VersionedTransaction(messageV0);
      transaction.sign([this.wallet]);

      const rawTransaction = transaction.serialize();
      const txid = await this.solanaConnection.sendRawTransaction(rawTransaction, {
        skipPreflight: true,
        maxRetries: 2,
      });
      const confirmation = await this.solanaConnection.confirmTransaction(
        { signature: txid, blockhash, lastValidBlockHeight },
        'confirmed'
      );
      if (confirmation.value.err) {
        throw new Error('Transaction failed');
      }
      await this.postTransactionProcessing(route, txid);
    } catch (error) {
      if (error instanceof ResponseError) {
        ArbBot.logDataToDatabase('info', await error.response.json(), { logFunc: 'executeSwap' }, this.botId);
      } else {
        ArbBot.logDataToDatabase('error', error, { logFunc: 'executeSwap' }, this.botId);
      }
      throw new Error('Unable to execute swap');
    } finally {
      this.waitingForConfirmation = false;
    }
  }

  async updateNextTrade(lastTrade) {
    const priceChange = this.targetGainPercentage / 100;
    this.nextTrade = {
      inputMint: this.nextTrade.outputMint,
      outputMint: this.nextTrade.inputMint,
      amount: parseInt(lastTrade.outAmount, 10),
      nextTradeThreshold: parseInt(lastTrade.inAmount, 10) * (1 + priceChange),
    };
  }

  async logSwap(args) {
    const { inputToken, inAmount, outputToken, outAmount, txId, timestamp } = args;
    const logEntry = {
      inputToken,
      inAmount,
      outputToken,
      outAmount,
      txId,
      timestamp,
    };

    const filePath = path.join(__dirname, 'trades.json');

    try {
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([logEntry], null, 2), 'utf-8');
      } else {
        const data = fs.readFileSync(filePath, { encoding: 'utf-8' });
        const trades = JSON.parse(data);
        trades.push(logEntry);
        fs.writeFileSync(filePath, JSON.stringify(trades, null, 2), 'utf-8');
      }
      ArbBot.logDataToDatabase(
        'info',
        `✅ Logged swap: ${inAmount} ${inputToken} -> ${outAmount} ${outputToken},\n  TX: ${txId}}`,
        { logFunc: 'logSwap' },
        this.botId
      );
    } catch (error) {
      ArbBot.logDataToDatabase('error', `'Error logging swap: ${error}`, { logFunc: 'logSwap' }, this.botId);
    }
  }

  terminateSession(reason) {
    ArbBot.logDataToDatabase('warning', `❌ Terminating bot...${reason}`, { logFunc: 'terminateSession' }, this.botId);
    ArbBot.logDataToDatabase(
      'info',
      `Current balances:\nSOL: ${this.solBalance / LAMPORTS_PER_SOL},\ntoken: ${this.tokenBalance}`,
      { logFunc: 'terminateSession' },
      this.botId
    );
    if (this.priceWatchIntervalId) {
      clearInterval(this.priceWatchIntervalId);
      this.priceWatchIntervalId = undefined; // Clear the reference to the interval
    }
    setTimeout(() => {
      ArbBot.logDataToDatabase('info', 'Bot has been terminated.', { logFunc: 'terminateSession' }, this.botId);
      process.exit(1);
    }, 1000);
  }

  static instructionDataToTransactionInstruction(instruction) {
    if (instruction === null || instruction === undefined) return null;
    return new TransactionInstruction({
      programId: new PublicKey(instruction.programId),
      keys: instruction.accounts.map((key) => ({
        pubkey: new PublicKey(key.pubkey),
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: Buffer.from(instruction.data, 'base64'),
    });
  }

  static async getAdressLookupTableAccounts(keys, connection) {
    const addressLookupTableAccountInfos = await connection.getMultipleAccountsInfo(keys.map((key) => new PublicKey(key)));

    return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
      const addressLookupTableAddress = keys[index];
      if (accountInfo) {
        const addressLookupTableAccount = new AddressLookupTableAccount({
          key: new PublicKey(addressLookupTableAddress),
          state: AddressLookupTableAccount.deserialize(accountInfo.data),
        });
        acc.push(addressLookupTableAccount);
      }

      return acc;
    }, []);
  }

  async postTransactionProcessing(quote, txid) {
    const { inputMint, inAmount, outputMint, outAmount } = quote;
    await this.updateNextTrade(quote);
    await this.refreshBalances();
    await this.logSwap({
      inputToken: inputMint,
      inAmount,
      outputToken: outputMint,
      outAmount,
      txId: txid,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  SwapToken,
  ArbBot,
};
