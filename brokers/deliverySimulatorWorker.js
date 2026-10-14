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

function getRandomDeliveryTime() {
  return Math.floor(Math.random() * (45000 - 30000 + 1)) + 30000;
}

async function deliverOrder(orderId, orderNumber) {
  try {
    console.log(`[DeliverySimulator] Order #${orderNumber} waiting for client pickup/delivery...`);

    // 1. Simulate client claiming time (30-45 seconds)
    const deliveryTime = getRandomDeliveryTime();
    await new Promise(resolve => setTimeout(resolve, deliveryTime));

    // 2. Update status to 'delivered'
    await dbPool.query(`UPDATE orders SET status = 'delivered', updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [orderId]);
    console.log(`[DeliverySimulator] Order #${orderNumber} successfully DELIVERED!`);
  } catch (err) {
    console.error(`[DeliverySimulator] Error delivering order ${orderNumber}:`, err.message);
  }
}

async function start() {
  await redisClient.connect();
  await redisClient.xGroupCreate('stream:orders:delivery', 'delivery-group', '0', { MKSTREAM: true }).catch(() => {});

  console.log('[DeliverySimulator] Worker started, listening on stream:orders:delivery...');
  while (true) {
    try {
      const res = await redisClient.xReadGroup('delivery-group', 'worker-4', [{ key: 'stream:orders:delivery', id: '>' }], { COUNT: 1, BLOCK: 5000 });
      if (res) {
        for (const stream of res) {
          for (const msg of stream.messages) {
            const { orderId, orderNumber } = msg.message;
            await deliverOrder(orderId, orderNumber);
            await redisClient.xAck('stream:orders:delivery', 'delivery-group', msg.id);
          }
        }
      }
    } catch (err) {
      console.error('[DeliverySimulator] Loop error:', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
start();