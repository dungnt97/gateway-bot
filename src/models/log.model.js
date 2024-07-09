const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const logSchema = mongoose.Schema(
  {
    level: {
      type: String,
      required: true,
      index: true,
    },
    bot: {
      type: mongoose.SchemaTypes.ObjectId,
      ref: 'Bot',
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    metadata: {
      type: Object,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
logSchema.plugin(toJSON);

/**
 * @typedef Log
 */
const Log = mongoose.model('Log', logSchema);

module.exports = Log;
