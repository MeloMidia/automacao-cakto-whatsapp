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
  assert.equal(text, [
    'Olá, Maria! 🚀',
    '',
    '🎉 Sua inscrição no curso Autopeças no Mercado Livre foi confirmada!',
    '',
    'Seja muito bem-vindo à Melo Mídia!',
    '',
    'Além do curso, você tem acesso à nossa Comunidade Autopeças do Mercado Livre, um espaço exclusivo para aprender, trocar experiências e crescer no Mercado Livre.',
    '',
    '✅ Contato direto com a equipe da Melo Mídia para tirar dúvidas.',
    '',
    '✅ Troca de experiências com outros profissionais do setor de autopeças.',
    '',
    '✅ Plantão de dúvidas ao vivo toda terça-feira, às 19h, pelo Google Meet, com nossa equipe.',
    '',
    '👥 Entre agora na nossa comunidade:',
    'https://chat.whatsapp.com/convite',
    '',
    'Estamos juntos nessa jornada! 💛',
    '',
    'Equipe Melo Mídia',
  ].join('\n'));
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
  assert.match(sentBody.text, /Comunidade Autopeças do Mercado Livre/);
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
