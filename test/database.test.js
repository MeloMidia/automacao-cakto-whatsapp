import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { claimNextJob, createDatabase, enqueueOrder, markSent, queueStats } from '../src/database.js';

test('deduplica o mesmo pedido e conclui a tarefa', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cakto-whatsapp-'));
  const db = createDatabase(path.join(directory, 'test.sqlite'));

  try {
    const job = {
      orderId: 'pedido-1',
      phone: '5511999999999',
      customerFirstName: 'Maria',
      productName: 'Curso',
    };
    assert.equal(enqueueOrder(db, job), true);
    assert.equal(enqueueOrder(db, job), false);

    const claimed = claimNextJob(db, 5);
    assert.equal(claimed.order_id, 'pedido-1');
    assert.equal(claimed.attempts, 1);

    markSent(db, claimed.id, 'wamid.123');
    assert.deepEqual(queueStats(db), { sent: 1 });
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('permite reenviar em modo real um pedido concluído em dry-run', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cakto-replay-'));
  const db = createDatabase(path.join(directory, 'test.sqlite'));
  const job = {
    orderId: 'pedido-dry-run',
    phone: '5511999999999',
    customerFirstName: 'Maria',
    productName: 'Curso',
  };

  try {
    assert.equal(enqueueOrder(db, job), true);
    const claimed = claimNextJob(db, 5);
    markSent(db, claimed.id, 'dry-run-pedido-dry-run');

    assert.equal(enqueueOrder(db, job), false);
    assert.equal(enqueueOrder(db, job, { replayDryRun: true }), true);
    assert.deepEqual(queueStats(db), { pending: 1 });
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
