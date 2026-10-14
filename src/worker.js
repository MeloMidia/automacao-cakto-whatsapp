import { claimNextJob, markFailed, markSent, nextJobDelayMs } from './database.js';
import { sendCommunityInvite } from './evolution.js';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function startWorker({ db, config, logger, send = sendCommunityInvite }) {
  let timer = null;
  let running = false;
  let stopped = false;
  let wakeRequested = false;

  const schedule = (delayMs) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, delayMs);
    timer.unref();
  };

  const tick = async () => {
    if (stopped) return;
    if (running) {
      wakeRequested = true;
      return;
    }

    running = true;
    let nextDelay = null;

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

        if (!stopped && !config.dryRun) {
          await sleep(config.evolution.minSendIntervalMs);
        }
      }
      nextDelay = nextJobDelayMs(db, config.maxSendAttempts);
    } catch (error) {
      logger.error('Falha no processamento da fila', { error: error.message });
      nextDelay = 5_000;
    } finally {
      running = false;
    }

    if (stopped) return;
    if (wakeRequested) {
      wakeRequested = false;
      schedule(0);
    } else if (nextDelay != null) {
      schedule(Math.max(250, nextDelay));
    }
  };

  const wake = () => {
    if (stopped) return;
    if (running) {
      wakeRequested = true;
      return;
    }
    schedule(0);
  };

  wake();

  return {
    wake,
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
