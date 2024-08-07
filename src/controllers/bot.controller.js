const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const { authService, botService } = require('../services');
const { startBot, killBot } = require('../jobs/job');

const createBot = catchAsync(async (req, res) => {
  const bot = await botService.createBot(req.body);

  res.status(httpStatus.CREATED).send({ bot });
});

const getBots = catchAsync(async (req, res) => {
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await botService.queryBots(null, options);
  res.send(result);
});

const getBot = catchAsync(async (req, res) => {
  const bot = await botService.getBotById(req.params.botId);
  if (!bot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bot not found');
  }
  res.send(bot);
});

const updateBot = catchAsync(async (req, res) => {
  const bot = await botService.updateBotById(req.params.botId, req.body);
  res.send(bot);
});

const runBot = catchAsync(async (req, res) => {
  try {
    const bot = await botService.getBotById(req.params.botId);
    const result = await startBot(bot);
    res.send({ data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const deleteBot = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const expireBot = catchAsync(async (req, res) => {
  try {
    const bot = await botService.getBotById(req.params.botId);
    await killBot(bot);
    res.send({ data: 'ok' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = {
  createBot,
  getBots,
  getBot,
  updateBot,
  runBot,
  deleteBot,
  expireBot,
};
