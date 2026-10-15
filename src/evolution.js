function evolutionBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function buildCommunityInvite(job, groupInviteUrl) {
  return [
    `Olá, ${job.customer_first_name}! 🚀`,
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
    groupInviteUrl,
    '',
    'Estamos juntos nessa jornada! 💛',
    '',
    'Equipe Melo Mídia',
  ].join('\n');
}

export async function sendCommunityInvite(config, job, { fetchImpl = fetch } = {}) {
  if (config.dryRun) {
    return { messageId: `dry-run-${job.order_id}` };
  }

  const baseUrl = evolutionBaseUrl(config.evolution.apiUrl);
  const instance = encodeURIComponent(config.evolution.instanceName);
  const url = `${baseUrl}/message/sendText/${instance}`;
  const body = {
    number: job.phone,
    text: buildCommunityInvite(job, config.evolution.groupInviteUrl),
  };

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      apikey: config.evolution.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = responseBody?.message || responseBody?.error || `HTTP ${response.status}`;
    throw new Error(`Evolution API: ${String(apiMessage)}`);
  }

  const messageId = responseBody?.key?.id;
  if (!messageId) throw new Error('Evolution API respondeu sem ID de mensagem');

  return { messageId };
}
