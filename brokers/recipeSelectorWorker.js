import 'dotenv/config';
import { dbPool, redisClient } from './shared/db.js';
import { logger } from './shared/logger.js';

const INVENTORY_CACHE_KEY = 'cache:inventory:status';

async function getInventory(client) {
  try {
    const cachedData = await redisClient.get(INVENTORY_CACHE_KEY);
    if (cachedData) {
      const inventoryArray = JSON.parse(cachedData);
      return new Map(inventoryArray.map(item => [item.ingredient_id, item.quantity]));
    }
  } catch (cacheErr) {
    logger.error('Redis cache read error', cacheErr);
  }

  const invQuery = `SELECT ingredient_id, quantity FROM ingredients_inventory;`;
  const { rows: inventoryRows } = await client.query(invQuery);
  return new Map(inventoryRows.map(i => [i.ingredient_id, i.quantity]));
}

async function processIntakeOrder() {
  const client = await dbPool.connect();
  try {
    while (true) {
      // 1. Get recipes and inventory requirements
      const recipesQuery = `
        SELECT r.id AS recipe_id, r.product, 
               json_agg(json_build_object('ingredient_id', ri.ingredient_id, 'quantity', ri.quantity)) AS requirements
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        GROUP BY r.id, r.product;
      `;
      const { rows: recipes } = await client.query(recipesQuery);
      const inventory = await getInventory(client);

      // 2. Filter satisfiable recipes
      const validRecipes = recipes.filter(recipe => {
        return recipe.requirements.every(req => {
          const stock = inventory.get(req.ingredient_id) || 0;
          return stock >= req.quantity;
        });
      });

      if (validRecipes.length > 0) {
        const chosenRecipe = validRecipes[Math.floor(Math.random() * validRecipes.length)];

        await client.query('BEGIN');
        
        // Deduct inventory
        for (const req of chosenRecipe.requirements) {
          await client.query(
            'UPDATE ingredients_inventory SET quantity = quantity - $1 WHERE ingredient_id = $2',
            [req.quantity, req.ingredient_id]
          );
        }

        // Step A: Insert order and get generated ID
        const insertOrderQuery = `
          INSERT INTO orders (recipe_id, status)
          VALUES ($1, 'confirmed')
          RETURNING id;
        `;
        const { rows: orderRows } = await client.query(insertOrderQuery, [chosenRecipe.recipe_id]);
        const orderId = orderRows[0].id;

        // Step B: Generate the custom order number using the row ID
        const orderNumber = `ORDEN-${orderId}`;

        // Step C: Update order_number column
        await client.query(
          `UPDATE orders SET order_number = $1 WHERE id = $2`,
          [orderNumber, orderId]
        );

        await client.query('COMMIT');
        logger.info(`Order #${orderNumber} assigned recipe '${chosenRecipe.product}' and confirmed.`);

        // Invalidate cache and push to Cooking Queue
        await redisClient.del(INVENTORY_CACHE_KEY);

        // --- NEW: Publish real-time events via Redis Pub/Sub ---
        await redisClient.publish(
          'events:orders',
          JSON.stringify({
            type: 'ORDERS_CREATED',
            data: { id: orderId, order_number: orderNumber, product: chosenRecipe.product, status: 'confirmed' }
          })
        );

        await redisClient.publish(
          'events:inventory',
          JSON.stringify({
            type: 'INVENTORY_UPDATED',
            data: {}
          })
        );
        // -------------------------------------------------------

        await redisClient.xAdd('stream:orders:cooking', '*', {
          orderId: orderId.toString(),
          orderNumber,
        });

        return true;
      }

      // 3. Out of stock: Trigger purchase and await response signal
      logger.info(`[RecipeSelector] Insufficient inventory. Requesting market purchase...`);
      await redisClient.xAdd('stream:inventory:purchase', '*', { timestamp: Date.now().toString() });

      logger.info(`[RecipeSelector] Awaiting restock signal from PurchasingAgent...`);
      
      let restocked = false;
      while (!restocked) {
        const restockRes = await redisClient.xRead(
          [{ key: 'stream:inventory:restocked', id: '$' }],
          { BLOCK: 10000 }
        );
        if (restockRes) {
          logger.info(`[RecipeSelector] Restock signal received! Re-checking inventory...`);
          restocked = true;
        }
      }

    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error(`Error processing intake order`, err);
    return false;
  } finally {
    client.release();
  }
}

async function start() {
  await redisClient.xGroupCreate('stream:orders:intake', 'recipe-group', '0', { MKSTREAM: true }).catch(() => {});
  
  logger.info('[RecipeSelector] Worker started, listening on stream:orders:intake...');
  while (true) {
    try {
      const res = await redisClient.xReadGroup('recipe-group', 'worker-selector', [{ key: 'stream:orders:intake', id: '>' }], { COUNT: 1, BLOCK: 5000 });
      if (res) {
        for (const stream of res) {
          for (const msg of stream.messages) {
            const success = await processIntakeOrder();
            if (success) {
              await redisClient.xAck('stream:orders:intake', 'recipe-group', msg.id);
            }
          }
        }
      }
    } catch (err) {
      logger.error('RecipeSelector loop error', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

start();