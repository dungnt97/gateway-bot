const { Worker } = require('worker_threads');

async function startBot(botData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('../gateway-bot/src/workers/worker.js', {
      workerData: botData,
    });

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

async function killBot() {
  Worker.all();
}

module.exports = {
  killBot,
  startBot,
};
