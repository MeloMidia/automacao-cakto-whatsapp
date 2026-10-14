const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
};

const boolean = (name, fallback) => {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return value.toLowerCase() === 'true';
};

const positiveInteger = (name, fallback) => {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export function loadConfig() {
  const dryRun = boolean('DRY_RUN', false);

  return {
    port: positiveInteger('PORT', 3000),
    databasePath: process.env.DATABASE_PATH?.trim() || './data/automation.sqlite',
    logLevel: process.env.LOG_LEVEL?.trim() || 'info',
    cakto: {
      secret: required('CAKTO_WEBHOOK_SECRET'),
      allowedProductIds: new Set(
        (process.env.CAKTO_ALLOWED_PRODUCT_IDS || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
      mainProductOnly: boolean('CAKTO_MAIN_PRODUCT_ONLY', true),
    },
    whatsapp: {
      apiVersion: process.env.META_GRAPH_API_VERSION?.trim() || 'v23.0',
      phoneNumberId: dryRun ? process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() : required('WHATSAPP_PHONE_NUMBER_ID'),
      accessToken: dryRun ? process.env.WHATSAPP_ACCESS_TOKEN?.trim() : required('WHATSAPP_ACCESS_TOKEN'),
      templateName: process.env.WHATSAPP_TEMPLATE_NAME?.trim() || 'convite_comunidade_compra',
      templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || 'pt_BR',
      groupInviteUrl: required('WHATSAPP_GROUP_INVITE_URL'),
    },
    dryRun,
    maxSendAttempts: positiveInteger('MAX_SEND_ATTEMPTS', 5),
  };
}
