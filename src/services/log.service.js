const { Log } = require('../models');

/**
 * Query for logs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryLogs = async (filter, options) => {
  const logs = await Log.paginate(filter, options);
  return logs;
};

/**
 * Get 100 latest logs with bot id
 * @param {string} botId
 * @returns {Promise<Bot>}
 */
const getLogsByBotId = async (botId) => {
  return Log.find({ bot: botId }).sort({ createdAt: -1 }).limit(100);
};

module.exports = {
  queryLogs,
  getLogsByBotId,
};
