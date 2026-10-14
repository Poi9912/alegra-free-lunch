import { redisClient } from './db.js';
import { logger } from './logger.js';

export async function getOrSetCache(key, ttlSeconds, fetchFunction) {
  try {
    // Check if exists in redis cache
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (err) {
    logger.error(`Cache read error for key: ${key}`, err);
  }

  // If not in redis goes to PostgreSQL
  const freshData = await fetchFunction();

  try {
    // Populates cache
    if (freshData !== null && freshData !== undefined) {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(freshData));
    }
  } catch (err) {
    logger.error(`Cache write error for key: ${key}`, err);
  }

  return freshData;
}