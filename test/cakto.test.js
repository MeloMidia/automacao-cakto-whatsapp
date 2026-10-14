import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { approvedOrders, parseCaktoPayload, verifyCaktoSignature } from '../src/cakto.js';

const secret = 'segredo-de-teste';
const order = {
  id: 'pedido-1',
  status: 'paid',
  offer_type: 'main',
  customer: { name: 'Maria Silva', phone: '5511999999999' },
  product: { id: 'produto-1', name: 'Curso' },
};

test('valida a assinatura oficial da Cakto', () => {
  const rawBody = Buffer.from(JSON.stringify({ event: 'purchase_approved', data: order }));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');

  assert.equal(verifyCaktoSignature({
    rawBody,
    timestamp,
    signature: `v1=${digest}`,
    secret,
  }), true);
  assert.equal(verifyCaktoSignature({
    rawBody,
    timestamp,
    signature: 'v1=incorreta',
    secret,
  }), false);
});

test('rejeita assinatura com mais de cinco minutos', () => {
  const rawBody = Buffer.from('{}');
  const timestamp = String(Math.floor(Date.now() / 1000) - 301);
  const digest = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');

  assert.equal(verifyCaktoSignature({
    rawBody,
    timestamp,
    signature: `v1=${digest}`,
    secret,
  }), false);
});

test('processa payload V1 e V2 e filtra somente o produto permitido', () => {
  const options = { allowedProductIds: new Set(['produto-1']), mainProductOnly: true };
  const v1 = { event: 'purchase_approved', data: order };
  const v2 = {
    event: 'purchase_approved',
    data: [order, { ...order, id: 'pedido-2', product: { id: 'outro', name: 'Outro' } }],
  };

  assert.deepEqual(approvedOrders(v1, options), [order]);
  assert.deepEqual(approvedOrders(v2, options), [order]);
  assert.deepEqual(approvedOrders({ ...v1, event: 'pix_gerado' }, options), []);
});

test('reporta JSON inválido', () => {
  assert.throws(() => parseCaktoPayload(Buffer.from('{')), /JSON inválido/);
});
