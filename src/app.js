import express from 'express';
import { approvedOrders, parseCaktoPayload, verifyBodySecret, verifyCaktoSignature } from './cakto.js';
import { enqueueOrder, queueStats } from './database.js';
import { firstName, normalizePhone } from './phone.js';

export function createApp({ config, db, logger }) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_request, response) => {
    response.json({ ok: true, dryRun: config.dryRun, queue: queueStats(db) });
  });

  app.post('/webhooks/cakto', express.raw({ type: 'application/json', limit: '256kb' }), (request, response) => {
    if (!Buffer.isBuffer(request.body)) {
      return response.status(415).json({ error: 'Content-Type deve ser application/json' });
    }

    let payload;
    try {
      payload = parseCaktoPayload(request.body);
    } catch (error) {
      return response.status(400).json({ error: error.message });
    }

    const timestamp = request.get('X-Cakto-Timestamp');
    const signature = request.get('X-Cakto-Signature');
    const validSignature = timestamp && signature
      ? verifyCaktoSignature({
          rawBody: request.body,
          timestamp,
          signature,
          secret: config.cakto.secret,
        })
      : false;

    // A Cakto documenta as duas formas de validação. O testador do painel pode
    // enviar o secret correto no corpo mesmo quando o header não é aproveitável.
    const validBodySecret = verifyBodySecret(payload.secret, config.cakto.secret);
    if (!validSignature && !validBodySecret) {
      logger.warn('Webhook Cakto rejeitado por autenticação');
      return response.status(401).json({ error: 'Assinatura inválida' });
    }

    const orders = approvedOrders(payload, config.cakto);
    let queued = 0;
    let duplicates = 0;
    let invalidPhones = 0;

    for (const order of orders) {
      try {
        const inserted = enqueueOrder(db, {
          orderId: String(order.id),
          phone: normalizePhone(order.customer.phone),
          customerFirstName: firstName(order.customer.name),
          productName: String(order.product.name || 'curso').slice(0, 120),
        });
        if (inserted) queued += 1;
        else duplicates += 1;
      } catch (error) {
        invalidPhones += 1;
        logger.warn('Pedido ignorado', { orderId: String(order.id), reason: error.message });
      }
    }

    logger.info('Webhook Cakto recebido', {
      event: payload.event,
      candidates: orders.length,
      queued,
      duplicates,
      invalidPhones,
    });

    return response.status(202).json({ received: true, queued, duplicates, invalidPhones });
  });

  app.use((_request, response) => response.status(404).json({ error: 'Rota não encontrada' }));
  return app;
}
