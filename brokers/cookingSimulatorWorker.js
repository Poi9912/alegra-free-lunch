import 'dotenv/config';
import pkg from 'pg';
import { createClient } from 'redis';

const { Pool } = pkg;
const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'restaurant_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secretpassword',
  port: 5432,
});

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });

// Random duration between 30 and 45 seconds (in ms)
function getRandomCookingTime() {
  return Math.floor(Math.random() * (45000 - 30000 + 1)) + 30000;
}

async function cookOrder(orderId, orderNumber) {
  try {
    // 1. Update status to 'cooking'
    await dbPool.query(`UPDATE orders SET status = 'cooking', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    console.log(`[CookingSimulator] Order #${orderNumber} is now COOKING...`);

    // 2. Simulate cooking delay (30-45 seconds)
    const cookTime = getRandomCookingTime();
    await new Promise(resolve => setTimeout(resolve, cookTime));

    // 3. Update status to 'ready'
    await dbPool.query(`UPDATE orders SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    console.log(`[CookingSimulator] Order #${orderNumber} is READY at the kitchen window!`);

    // 4. Push to Delivery Queue
    await redisClient.xAdd('stream:orders:delivery', '*', {
      orderId: orderId.toString(),
      orderNumber,
    });
  } catch (err) {
    console.error(`[CookingSimulator] Error cooking order ${orderNumber}:`, err.message);
  }
}

async function start() {
  await redisClient.connect();
  await redisClient.xGroupCreate('stream:orders:cooking', 'cooking-group', '0', { MKSTREAM: true }).catch(() => {});

  console.log('[CookingSimulator] Worker started, listening on stream:orders:cooking...');
  while (true) {
    try {
      const res = await redisClient.xReadGroup('cooking-group', 'worker-3', [{ key: 'stream:orders:cooking', id: '>' }], { COUNT: 1, BLOCK: 5000 });
      if (res) {
        for (const stream of res) {
          for (const msg of stream.messages) {
            const { orderId, orderNumber } = msg.message;
            await cookOrder(orderId, orderNumber);
            await redisClient.xAck('stream:orders:cooking', 'cooking-group', msg.id);
          }
        }
      }
    } catch (err) {
      console.error('[CookingSimulator] Loop error:', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
start();