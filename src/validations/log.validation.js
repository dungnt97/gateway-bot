const Joi = require('joi');
const { objectId } = require('./custom.validation');

const getLogsByBotId = {
  params: Joi.object().keys({
    botId: Joi.required().custom(objectId),
  }),
};

module.exports = {
  getLogsByBotId,
};
