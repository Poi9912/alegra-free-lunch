import 'dotenv/config';
import { connectRedisClient, dbPool, redisClient } from './shared/db.js';
import { logger } from './shared/logger.js';
import { getRandomDelay } from './shared/timer.js';

const BATCH_COUNT = parseInt(process.env.BATCH_COUNT, 10) || 5;

export async function cookOrder(orderId, orderNumber) {
  try {
    // 1. Status -> Cooking
    await dbPool.query(`UPDATE orders SET status = 'cooking', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    logger.info(`Order #${orderNumber} is now COOKING...`);

    // --- NEW: Publish cooking event ---
    await redisClient.publish(
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: parseInt(orderId), order_number: orderNumber, status: 'cooking' }
      })
    );
    // ---------------------------------

    const cookTime = getRandomDelay(30000, 45000);
    await new Promise(resolve => setTimeout(resolve, cookTime));

    // 2. Status -> Ready
    await dbPool.query(`UPDATE orders SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    logger.info(`Order #${orderNumber} is READY at the kitchen window!`);

    // --- NEW: Publish ready event ---
    await redisClient.publish(
      'events:orders',
      JSON.stringify({
        type: 'ORDER_UPDATED',
        data: { id: parseInt(orderId), order_number: orderNumber, status: 'ready' }
      })
    );
    // -------------------------------

    await redisClient.xAdd('stream:orders:delivery', '*', {
      orderId: orderId.toString(),
      orderNumber,
    });
  } catch (err) {
    logger.error(`Error cooking order ${orderNumber}`, err);
  }
}

export async function start() {
  await connectRedisClient();
  await redisClient.xGroupCreate('stream:orders:cooking', 'cooking-group', '0', { MKSTREAM: true }).catch(() => {});

  logger.info(`CookingSimulator worker started with batch concurrency (${BATCH_COUNT}), listening on stream:orders:cooking...`);
  
  while (true) {
    try {
      const res = await redisClient.xReadGroup(
        'cooking-group',
        'worker-cooking',
        [{ key: 'stream:orders:cooking', id: '>' }],
        { COUNT: BATCH_COUNT, BLOCK: 5000 }
      );

      if (res) {
        for (const stream of res) {
          stream.messages.forEach((msg) => {
            const { orderId, orderNumber } = msg.message;
            
            cookOrder(orderId, orderNumber)
              .then(async () => {
                await redisClient.xAck('stream:orders:cooking', 'cooking-group', msg.id);
              })
              .catch((err) => {
                logger.error(`Failed to process and ack order ${orderNumber}`, err);
              });
          });
        }
      }
    } catch (err) {
      logger.error('CookingSimulator loop error', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

/* istanbul ignore next */
if (process.env.NODE_ENV !== 'test') {
  start();
}