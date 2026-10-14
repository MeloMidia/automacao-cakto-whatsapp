import assert from 'node:assert/strict';
import test from 'node:test';
import { sendCommunityInvite } from '../src/whatsapp.js';

test('envia template com as variáveis esperadas', async () => {
  let captured;
  const fetchImpl = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      async json() {
        return { messages: [{ id: 'wamid.123' }] };
      },
    };
  };
  const config = {
    dryRun: false,
    whatsapp: {
      apiVersion: 'v23.0',
      phoneNumberId: '123456',
      accessToken: 'token-secreto',
      templateName: 'convite_comunidade_compra',
      templateLanguage: 'pt_BR',
      groupInviteUrl: 'https://chat.whatsapp.com/convite',
    },
  };
  const job = {
    order_id: 'pedido-1',
    phone: '5511999999999',
    customer_first_name: 'Maria',
    product_name: 'Curso Teste',
  };

  const result = await sendCommunityInvite(config, job, { fetchImpl });
  const sentBody = JSON.parse(captured.options.body);

  assert.equal(result.messageId, 'wamid.123');
  assert.equal(captured.url, 'https://graph.facebook.com/v23.0/123456/messages');
  assert.equal(sentBody.to, '5511999999999');
  assert.deepEqual(
    sentBody.template.components[0].parameters.map((parameter) => parameter.parameter_name),
    ['nome', 'produto', 'link'],
  );
  assert.equal(captured.options.headers.Authorization, 'Bearer token-secreto');
});
