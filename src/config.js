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
    evolution: {
      apiUrl: dryRun ? process.env.EVOLUTION_API_URL?.trim() : required('EVOLUTION_API_URL'),
      apiKey: dryRun ? process.env.EVOLUTION_API_KEY?.trim() : required('EVOLUTION_API_KEY'),
      instanceName: dryRun ? process.env.EVOLUTION_INSTANCE_NAME?.trim() : required('EVOLUTION_INSTANCE_NAME'),
      minSendIntervalMs: positiveInteger('EVOLUTION_MIN_SEND_INTERVAL_MS', 7000),
      groupInviteUrl: required('WHATSAPP_GROUP_INVITE_URL'),
    },
    dryRun,
    maxSendAttempts: positiveInteger('MAX_SEND_ATTEMPTS', 5),
  };
}
