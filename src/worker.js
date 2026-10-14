import { claimNextJob, markFailed, markSent } from './database.js';
import { sendCommunityInvite } from './whatsapp.js';

export function startWorker({ db, config, logger, intervalMs = 1000, send = sendCommunityInvite }) {
  let timer;
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (running || stopped) return;
    running = true;

    try {
      let job;
      while (!stopped && (job = claimNextJob(db, config.maxSendAttempts))) {
        try {
          const result = await send(config, job);
          markSent(db, job.id, result.messageId);
          logger.info('Convite enviado', {
            orderId: job.order_id,
            dryRun: config.dryRun,
            messageId: result.messageId,
          });
        } catch (error) {
          markFailed(db, job.id, error.message, job.attempts, config.maxSendAttempts);
          logger.error('Falha ao enviar convite', {
            orderId: job.order_id,
            attempt: job.attempts,
            error: error.message,
          });
        }
      }
    } finally {
      running = false;
    }
  };

  timer = setInterval(tick, intervalMs);
  timer.unref();
  void tick();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
