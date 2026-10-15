import 'dotenv/config';
import { dbPool, redisClient } from './shared/db.js';
import { logger } from './shared/logger.js';

const EXTERNAL_API = process.env.EXTERNAL_API || 'https://recruitment.alegra.com/api/farmers-market/buy';
const INVENTORY_CACHE_KEY = 'cache:inventory:status';

async function restockInventory() {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    logger.info('[PurchasingAgent] Stock shortage detected. Querying external farmers market API...');

    const { rows: ingredients } = await client.query('SELECT id, name FROM ingredients;');
    let restockedCount = 0;

    for (const ing of ingredients) {
      await client.query('SAVEPOINT ingredient_sp');

      try {
        const url = `${EXTERNAL_API}?ingredient=${encodeURIComponent(ing.name)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          logger.error(`Market API error for '${ing.name}': HTTP ${response.status}`);
          await client.query('ROLLBACK TO SAVEPOINT ingredient_sp');
          continue;
        }

        const data = await response.json();
        const quantitySold = data.quantitySold || 0;

        if (quantitySold > 0) {
          logger.info(`Successfully purchased ${quantitySold} units of '${ing.name}'.`);

          // Explicit Select-then-Update/Insert to avoid missing unique constraint errors
          const existing = await client.query(
            `SELECT ingredient_id FROM ingredients_inventory WHERE ingredient_id = $1`,
            [ing.id]
          );

          if (existing.rows.length > 0) {
            await client.query(
              `UPDATE ingredients_inventory SET quantity = quantity + $2 WHERE ingredient_id = $1`,
              [ing.id, quantitySold]
            );
          } else {
            await client.query(
              `INSERT INTO ingredients_inventory (ingredient_id, quantity) VALUES ($1, $2)`,
              [ing.id, quantitySold]
            );
          }

          // Log purchase history
          await client.query(
            `INSERT INTO inventory_purchase_history (ingredient_id, quantity) VALUES ($1, $2)`,
            [ing.id, quantitySold]
          );

          restockedCount++;
          await client.query('RELEASE SAVEPOINT ingredient_sp');
        } else {
          logger.info(`Ingredient '${ing.name}' is currently unavailable in the market (quantitySold: 0).`);
          await client.query('RELEASE SAVEPOINT ingredient_sp');
        }
      } catch (itemErr) {
        await client.query('ROLLBACK TO SAVEPOINT ingredient_sp');
        logger.error(`Error/Parsing error for ingredient '${ing.name}'`, itemErr);
      }
    }

    await client.query('COMMIT');
    logger.info('[PurchasingAgent] Restock transaction committed successfully.');

    if (restockedCount > 0) {
      await redisClient.del(INVENTORY_CACHE_KEY);
      logger.info(`Cleared Redis cache key '${INVENTORY_CACHE_KEY}'.`);
    }

    await redisClient.xAdd('stream:inventory:restocked', '*', { timestamp: Date.now().toString() });
    logger.info('[PurchasingAgent] Sent restock signal to stream:inventory:restocked.');

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('[PurchasingAgent] Restock transaction failed', err);
  } finally {
    client.release();
  }
}

async function start() {
  await redisClient.xGroupCreate('stream:inventory:purchase', 'purchase-group', '0', { MKSTREAM: true }).catch(() => {});

  logger.info('[PurchasingAgent] Worker started, listening on stream:inventory:purchase...');
  while (true) {
    try {
      const res = await redisClient.xReadGroup(
        'purchase-group',
        'worker-purchasing',
        [{ key: 'stream:inventory:purchase', id: '>' }],
        { COUNT: 1, BLOCK: 5000 }
      );

      if (res) {
        for (const stream of res) {
          for (const msg of stream.messages) {
            await restockInventory();
            await redisClient.xAck('stream:inventory:purchase', 'purchase-group', msg.id);
          }
        }
      }
    } catch (err) {
      logger.error('[PurchasingAgent] Stream loop error', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();