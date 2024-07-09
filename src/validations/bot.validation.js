const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createBot = {
  body: Joi.object().keys({
    secretKey: Joi.string().required(),
    type: Joi.string().required(),
    firstMintToken: Joi.string().required(),
    secondMintToken: Joi.string().required(),
    firstTradePrice: Joi.string().required(),
    targetGainPercentage: Joi.string().required(),
    initialInputAmount: Joi.string().required(),
    expires: Joi.string().required(),
  }),
};

const getBots = {
  query: Joi.object().keys({
    secretKey: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number().integer(),
    page: Joi.number().integer(),
  }),
};

const getBot = {
  params: Joi.object().keys({
    botId: Joi.string().custom(objectId),
  }),
};

const updateBot = {
  params: Joi.object().keys({
    botId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      secretKey: Joi.string().required(),
      type: Joi.string().required(),
      firstMintToken: Joi.string().required(),
      secondMintToken: Joi.string().required(),
      firstTradePrice: Joi.string().required(),
      targetGainPercentage: Joi.string().required(),
      initialInputAmount: Joi.string().required(),
      expires: Joi.string().required(),
    })
    .min(1),
};

const deleteBot = {
  params: Joi.object().keys({
    botId: Joi.string().custom(objectId),
  }),
};

const runBot = {
  params: Joi.object().keys({
    botId: Joi.string().custom(objectId),
  }),
};

const expireBot = {
  params: Joi.object().keys({
    botId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createBot,
  getBots,
  getBot,
  updateBot,
  deleteBot,
  runBot,
  expireBot,
};
