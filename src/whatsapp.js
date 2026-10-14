export async function sendCommunityInvite(config, job, { fetchImpl = fetch } = {}) {
  if (config.dryRun) {
    return { messageId: `dry-run-${job.order_id}` };
  }

  const url = `https://graph.facebook.com/${encodeURIComponent(config.whatsapp.apiVersion)}/${encodeURIComponent(config.whatsapp.phoneNumberId)}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: job.phone,
    type: 'template',
    template: {
      name: config.whatsapp.templateName,
      language: { code: config.whatsapp.templateLanguage },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', parameter_name: 'nome', text: job.customer_first_name },
            { type: 'text', parameter_name: 'produto', text: job.product_name },
            { type: 'text', parameter_name: 'link', text: config.whatsapp.groupInviteUrl },
          ],
        },
      ],
    },
  };

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiMessage = responseBody?.error?.message || `HTTP ${response.status}`;
    const apiCode = responseBody?.error?.code;
    throw new Error(`WhatsApp API: ${apiMessage}${apiCode ? ` (código ${apiCode})` : ''}`);
  }

  return { messageId: responseBody?.messages?.[0]?.id || null };
}
