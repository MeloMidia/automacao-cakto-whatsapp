import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDatabase, enqueueOrder, queueStats } from '../src/database.js';
import { startWorker } from '../src/worker.js';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('worker ocioso desperta quando uma nova venda entra na fila', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cakto-worker-'));
  const db = createDatabase(path.join(directory, 'test.sqlite'));
  let invitationSent;
  const sent = new Promise((resolve) => { invitationSent = resolve; });
  const logger = { debug() {}, info() {}, warn() {}, error() {} };
  const config = {
    dryRun: true,
    maxSendAttempts: 5,
    evolution: { minSendIntervalMs: 1 },
  };
  const worker = startWorker({
    db,
    config,
    logger,
    send: async () => {
      invitationSent();
      return { messageId: 'mensagem-1' };
    },
  });

  try {
    await wait(20);
    assert.deepEqual(queueStats(db), {});

    enqueueOrder(db, {
      orderId: 'pedido-worker',
      phone: '5511999999999',
      customerFirstName: 'Maria',
      productName: 'Curso',
    });
    worker.wake();

    await Promise.race([
      sent,
      wait(1_000).then(() => { throw new Error('worker não despertou'); }),
    ]);
    await wait(20);
    assert.deepEqual(queueStats(db), { sent: 1 });
  } finally {
    worker.stop();
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
