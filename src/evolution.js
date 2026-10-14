function evolutionBaseUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function buildCommunityInvite(job, groupInviteUrl) {
  return [
    `Olá, ${job.customer_first_name}! 🎉`,
    '',
    `Seu pagamento do ${job.product_name} foi confirmado.`,
    '',
    'A comunidade exclusiva faz parte da sua compra. Entre pelo link:',
    groupInviteUrl,
    '',
    'Se precisar de ajuda, responda a esta mensagem.',
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
