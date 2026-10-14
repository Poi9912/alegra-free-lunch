import pkg from 'pg';
import { createClient } from 'redis';
import { logger } from './logger.js';

const { Pool } = pkg;

export const dbPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'restaurant_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secretpassword',
  port: 5432,
});

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

async function connectClients() {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis successfully');
  } catch (err) {
    logger.error('Failed to connect to Redis', err);
  }
}

connectClients();