import 'dotenv/config';
import pkg from 'pg';
import { createClient } from 'redis';

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

export function connectRedisClient() {
  return redisClient.connect();
}