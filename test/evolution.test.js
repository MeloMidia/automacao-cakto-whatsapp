import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommunityInvite, sendCommunityInvite } from '../src/evolution.js';

const job = {
  order_id: 'pedido-1',
  phone: '5511999999999',
  customer_first_name: 'Maria',
  product_name: 'Curso Teste',
};

test('monta uma mensagem transacional com o convite', () => {
  const text = buildCommunityInvite(job, 'https://chat.whatsapp.com/convite');
  assert.match(text, /Olá, Maria!/);
  assert.match(text, /pagamento do Curso Teste foi confirmado/);
  assert.match(text, /https:\/\/chat\.whatsapp\.com\/convite/);
});

test('envia texto pela Evolution API', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      async json() {
        return { key: { id: 'evolution-message-123' } };
      },
    };
  };
  const config = {
    dryRun: false,
    evolution: {
      apiUrl: 'evolution.exemplo.com/',
      apiKey: 'api-key-secreta',
      instanceName: 'sistemamelo',
      minSendIntervalMs: 7000,
      groupInviteUrl: 'https://chat.whatsapp.com/convite',
    },
  };

  const result = await sendCommunityInvite(config, job, { fetchImpl });
  const sentBody = JSON.parse(captured.options.body);

  assert.equal(result.messageId, 'evolution-message-123');
  assert.equal(captured.url, 'https://evolution.exemplo.com/message/sendText/sistemamelo');
  assert.equal(sentBody.number, '5511999999999');
  assert.match(sentBody.text, /comunidade exclusiva/);
  assert.equal(captured.options.headers.apikey, 'api-key-secreta');
});

test('falha quando a Evolution não retorna ID de mensagem', async () => {
  const config = {
    dryRun: false,
    evolution: {
      apiUrl: 'https://evolution.exemplo.com',
      apiKey: 'key',
      instanceName: 'instancia',
      groupInviteUrl: 'https://chat.whatsapp.com/convite',
    },
  };
  const fetchImpl = async () => ({ ok: true, json: async () => ({}) });

  await assert.rejects(
    sendCommunityInvite(config, job, { fetchImpl }),
    /sem ID de mensagem/,
  );
});
