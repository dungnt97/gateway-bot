const catchAsync = require('../utils/catchAsync');
const pick = require('../utils/pick');
const { logService } = require('../services');

const getLogs = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await logService.queryBots(null, options);
  res.send(result);
});

const getLogsByBotId = catchAsync(async (req, res) => {
  const logs = await logService.getLogsByBotId(req.params.botId);
  res.send(logs);
});

module.exports = {
  getLogs,
  getLogsByBotId,
};
