import crypto from 'node:crypto';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function safeEqual(left, right) {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyCaktoSignature({ rawBody, timestamp, signature, secret, now = Date.now() }) {
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(now / 1000 - sentAt) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expectedDigest = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');

  const expected = `v1=${expectedDigest}`;
  return String(signature || '')
    .split(',')
    .map((value) => value.trim())
    .some((candidate) => candidate.startsWith('v1=') && safeEqual(candidate, expected));
}

export function verifyBodySecret(receivedSecret, expectedSecret) {
  return safeEqual(String(receivedSecret || ''), expectedSecret);
}

export function parseCaktoPayload(rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new Error('JSON inválido');
  }

  if (!payload || typeof payload !== 'object' || typeof payload.event !== 'string') {
    throw new Error('Payload inválido');
  }

  return payload;
}

export function approvedOrders(payload, { allowedProductIds = new Set(), mainProductOnly = true } = {}) {
  if (payload.event !== 'purchase_approved') return [];

  const entries = Array.isArray(payload.data) ? payload.data : [payload.data];
  return entries.filter((order) => {
    if (!order || typeof order !== 'object') return false;
    if (!order.id || order.status !== 'paid') return false;
    if (!order.customer?.phone || !order.product?.id) return false;
    if (mainProductOnly && order.offer_type && order.offer_type !== 'main') return false;
    if (allowedProductIds.size > 0 && !allowedProductIds.has(String(order.product.id))) return false;
    return true;
  });
}
