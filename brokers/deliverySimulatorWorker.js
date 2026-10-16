import 'dotenv/config';
import { dbPool, redisClient } from './shared/db.js';
import { logger } from './shared/logger.js';
import { getRandomDelay } from './shared/timer.js';

const BATCH_COUNT = process.env.BATCH_COUNT || 10;

async function deliverOrder(orderId, orderNumber) {
  try {
    logger.info(`Order #${orderNumber} waiting for client pickup/delivery...`);

    const deliveryTime = getRandomDelay(30000, 45000);
    await new Promise(resolve => setTimeout(resolve, deliveryTime));

    await dbPool.query(`UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    logger.info(`Order #${orderNumber} successfully DELIVERED!`);

    // --- NEW: Publish delivered event ---
    await redisClient.publish(
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: parseInt(orderId), order_number: orderNumber, status: 'delivered' }
      })
    );
    // -----------------------------------
  } catch (err) {
    logger.error(`Error delivering order ${orderNumber}`, err);
  }
}

async function start() {
  await redisClient.xGroupCreate('stream:orders:delivery', 'delivery-group', '0', { MKSTREAM: true }).catch(() => {});

  logger.info(`DeliverySimulator worker started with batch concurrency (${BATCH_COUNT}), listening on stream:orders:delivery...`);
  
  while (true) {
    try {
      const res = await redisClient.xReadGroup(
        'delivery-group',
        'worker-delivery',
        [{ key: 'stream:orders:delivery', id: '>' }],
        { COUNT: BATCH_COUNT, BLOCK: 5000 }
      );

      if (res) {
        for (const stream of res) {
          await Promise.all(
            stream.messages.map(async (msg) => {
              const { orderId, orderNumber } = msg.message;
              await deliverOrder(orderId, orderNumber);
              await redisClient.xAck('stream:orders:delivery', 'delivery-group', msg.id);
            })
          );
        }
      }
    } catch (err) {
      logger.error('DeliverySimulator loop error', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();