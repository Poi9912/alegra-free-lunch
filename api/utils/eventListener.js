import { createClient } from 'redis';
import { broadcastUpdate } from './websocketManager.js';
import { logger } from './logger.js';

export async function setupRedisEventListeners() {
  // Redis requires a dedicated client connection for subscribing
  const subscriber = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  
  subscriber.on('error', (err) => logger.error('Redis Subscriber Error', err));

  await subscriber.connect();

  // Subscribe to order and inventory event channels
  await subscriber.subscribe('events:orders', (message) => {
    try {
      const event = JSON.parse(message);
      logger.info(`Broadcasting order event: ${event.type}`);
      broadcastUpdate(event.type, event.data);
    } catch (err) {
      logger.error('Failed to parse order event message', err);
    }
  });

  await subscriber.subscribe('events:inventory', (message) => {
    try {
      const event = JSON.parse(message);
      logger.info(`Broadcasting inventory event: ${event.type}`);
      broadcastUpdate(event.type, event.data);
    } catch (err) {
      logger.error('Failed to parse inventory event message', err);
    }
  });

  logger.info('🟢 Redis event listener successfully subscribed to channels.');
}