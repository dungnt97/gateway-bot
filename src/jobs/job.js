const path = require('path');
const { fork } = require('child_process');
const { botService } = require('../services');
const { botStatusTypes } = require('../config/bots');

async function startBot(botData) {
  return new Promise((resolve, reject) => {
    const worker = fork(path.join(__dirname, '../workers/worker.js'));
    const processPid = worker.pid;

    botService.updateBotById(botData._id, { processPid, status: botStatusTypes.ACTIVE });

    worker.send(botData);

    worker.on('message', (result) => {
      resolve(result);
    });

    worker.on('error', (err) => {
      reject(err);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

async function killBot(botData) {
  const { processPid } = botData;

  try {
    process.kill(processPid, 'SIGTERM');
    botService.updateBotById(botData._id, { processPid: null, status: botStatusTypes.DEACTIVATED });
  } catch (err) {
    throw new Error(err);
  }
}

module.exports = {
  killBot,
  startBot,
};
