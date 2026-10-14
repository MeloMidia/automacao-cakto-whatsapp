import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { createDatabase, queueStats } from '../src/database.js';

function silentLogger() {
  return { debug() {}, info() {}, warn() {}, error() {} };
}

test('recebe, autentica e deduplica o webhook por HTTP', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cakto-app-'));
  const db = createDatabase(path.join(directory, 'test.sqlite'));
  const secret = 'segredo-app';
  const config = {
    dryRun: true,
    cakto: {
      secret,
      allowedProductIds: new Set(['produto-1']),
      mainProductOnly: true,
    },
  };
  const server = createApp({ config, db, logger: silentLogger() }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const body = JSON.stringify({
      secret,
      event: 'purchase_approved',
      data: {
        id: 'pedido-http',
        status: 'paid',
        offer_type: 'main',
        customer: { name: 'Maria Silva', phone: '(11) 99999-9999' },
        product: { id: 'produto-1', name: 'Curso Teste' },
      },
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v1=${crypto.createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(Buffer.from(body))
      .digest('hex')}`;
    const url = `http://127.0.0.1:${server.address().port}/webhooks/cakto`;
    const headers = {
      'content-type': 'application/json',
      'x-cakto-timestamp': timestamp,
      'x-cakto-signature': signature,
    };

    const first = await fetch(url, { method: 'POST', headers, body });
    assert.equal(first.status, 202);
    assert.deepEqual(await first.json(), {
      received: true,
      queued: 1,
      duplicates: 0,
      invalidPhones: 0,
    });

    const duplicate = await fetch(url, { method: 'POST', headers, body });
    assert.equal(duplicate.status, 202);
    assert.equal((await duplicate.json()).duplicates, 1);
    assert.deepEqual(queueStats(db), { pending: 1 });

    const invalid = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'x-cakto-signature': 'v1=adulterada' },
      body: JSON.stringify({ ...JSON.parse(body), secret: 'segredo-incorreto' }),
    });
    assert.equal(invalid.status, 401);

    const bodySecretFallback = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'x-cakto-signature': 'v1=adulterada' },
      body,
    });
    assert.equal(bodySecretFallback.status, 202);
    assert.equal((await bodySecretFallback.json()).duplicates, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
