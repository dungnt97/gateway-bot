const httpStatus = require('http-status');
const { Bot } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a bot
 * @param {Object} botBody
 * @returns {Promise<Bot>}
 */
const createBot = async (botBody) => {
  if (await Bot.isPrivateKeyTaken(botBody.secretKey)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'secret key already taken');
  }
  return Bot.create(botBody);
};

/**
 * Query for bots
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryBots = async (filter, options) => {
  const bots = await Bot.paginate(filter, options);
  return bots;
};

/**
 * Get bot by id
 * @param {ObjectId} id
 * @returns {Promise<Bot>}
 */
const getBotById = async (id) => {
  return Bot.findById(id);
};

/**
 * Get bot by private key
 * @param {string} privateKey
 * @returns {Promise<Bot>}
 */
const getBotByPrivateKey = async (privateKey) => {
  return Bot.findOne({ privateKey });
};

/**
 * Update bot by id
 * @param {ObjectId} botId
 * @param {Object} updateBody
 * @returns {Promise<Bot>}
 */
const updateBotById = async (botId, updateBody) => {
  const bot = await getBotById(botId);
  if (!bot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bot not found');
  }
  if (updateBody.privateKey && (await Bot.isPrivateKeyTaken(updateBody.privateKey, botId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Private key already taken');
  }
  Object.assign(bot, updateBody);
  await bot.save();
  return bot;
};

/**
 * Delete bot by id
 * @param {ObjectId} botId
 * @returns {Promise<Bot>}
 */
const deleteBotById = async (botId) => {
  const bot = await getBotById(botId);
  if (!bot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bot not found');
  }
  await bot.remove();
  return bot;
};

const runBot = async () => {};

const expiredBotById = async () => {};

module.exports = {
  createBot,
  runBot,
  queryBots,
  getBotById,
  getBotByPrivateKey,
  updateBotById,
  deleteBotById,
  expiredBotById,
};
