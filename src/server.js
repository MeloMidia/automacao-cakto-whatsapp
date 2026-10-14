import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase } from './database.js';
import { createLogger } from './logger.js';
import { startWorker } from './worker.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(JSON.stringify({ level: 'error', message: error.message }));
  process.exit(1);
}

const logger = createLogger(config.logLevel);
const db = createDatabase(config.databasePath);
const worker = startWorker({ db, config, logger });
const app = createApp({ config, db, logger, onJobsQueued: worker.wake });

const server = app.listen(config.port, () => {
  logger.info('Automação iniciada', { port: config.port, dryRun: config.dryRun });
});

const shutdown = (signal) => {
  logger.info('Encerrando automação', { signal });
  worker.stop();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
