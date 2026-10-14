import 'dotenv/config';
import { dbPool, redisClient } from './shared/db.js';

const EXTERNAL_API = process.env.EXTERNAL_API || 'https://recruitment.alegra.com/api/farmers-market/buy';

async function restockInventory() {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    console.log('[PurchasingAgent] Stock shortage detected. Querying external farmers market API...');

    // 1. Fetch all ingredients (id and name) from the database
    const { rows: ingredients } = await client.query('SELECT id, name FROM ingredients;');

    for (const ing of ingredients) {
      try {
        // Construct the URL with the ingredient query parameter matching the database name
        const url = `${EXTERNAL_API}?ingredient=${encodeURIComponent(ing.name)}`;
        console.log(`[PurchasingAgent] Requesting ingredient '${ing.name}' from market: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`[PurchasingAgent] Market API error for ${ing.name}: HTTP ${response.status}`);
          continue;
        }

        const data = await response.json();
        const quantitySold = data.quantitySold || 0;

        // If quantitySold is greater than 0, add to inventory and log purchase history
        if (quantitySold > 0) {
          console.log(`[PurchasingAgent] Successfully purchased ${quantitySold} units of '${ing.name}'.`);

          // Update inventory
          await client.query(
            `INSERT INTO ingredients_inventory (ingredient_id, quantity) 
             VALUES ($1, $2)
             ON CONFLICT (ingredient_id) DO UPDATE SET quantity = ingredients_inventory.quantity + $2`,
            [ing.id, quantitySold]
          );

          // Log purchase history
          await client.query(
            `INSERT INTO inventory_purchase_history (ingredient_id, quantity) VALUES ($1, $2)`,
            [ing.id, quantitySold]
          );
        } else {
          console.log(`[PurchasingAgent] Ingredient '${ing.name}' is currently unavailable in the market (quantitySold: 0).`);
        }
      } catch (apiErr) {
        console.error(`[PurchasingAgent] Network/Parsing error for ingredient '${ing.name}':`, apiErr.message);
      }
    }

    await client.query('COMMIT');
    console.log('[PurchasingAgent] Restock operation completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[PurchasingAgent] Restock transaction failed:', err.message);
  } finally {
    client.release();
  }
}

async function start() {
  // Ensure consumer group exists for the stock purchase stream
  await redisClient.xGroupCreate('stream:inventory:purchase', 'purchase-group', '0', { MKSTREAM: true }).catch(() => {});

  console.log('[PurchasingAgent] Worker started, listening on stream:inventory:purchase...');
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
      console.error('[PurchasingAgent] Stream loop error:', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();