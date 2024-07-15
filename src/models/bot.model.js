const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const { botTypes, botStatusTypes } = require('../config/bots');

const botSchema = mongoose.Schema(
  {
    secretKey: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [botTypes.TRADING, botTypes.CASHOUT],
      required: true,
    },
    firstMintToken: {
      type: String,
      required: true,
    },
    secondMintToken: {
      type: String,
      required: true,
    },
    firstTradePrice: {
      type: Number,
      required: true,
    },
    targetGainPercentage: {
      type: Number,
      required: true,
    },
    initialInputAmount: {
      type: Number,
      required: true,
    },
    expired: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: [botStatusTypes.ACTIVE, botStatusTypes.DEACTIVATED],
      default: botStatusTypes.DEACTIVATED,
      required: true,
    },
    processPid: {
      type: Number,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
botSchema.plugin(toJSON);
botSchema.plugin(paginate);
/**
 * Check if private key is taken
 * @param {string} privatekey - The bot's private key
 * @returns {Promise<boolean>}
 */
botSchema.statics.isPrivateKeyTaken = async function (privatekey) {
  const bot = await this.findOne({ privatekey });
  return !!bot;
};

/**
 * @typedef Bot
 */
const Bot = mongoose.model('Bot', botSchema);

module.exports = Bot;
