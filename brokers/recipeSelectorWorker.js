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

async function processIntakeOrder(orderNumber) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get all recipes and their ingredient requirements
    const recipesQuery = `
      SELECT r.id AS recipe_id, r.product, 
             json_agg(json_build_object('ingredient_id', ri.ingredient_id, 'quantity', ri.quantity)) AS requirements
      FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      GROUP BY r.id, r.product;
    `;
    const { rows: recipes } = await client.query(recipesQuery);

    // 2. Get current inventory
    const invQuery = `SELECT ingredient_id, quantity FROM ingredients_inventory;`;
    const { rows: inventoryRows } = await client.query(invQuery);
    const inventory = new Map(inventoryRows.map(i => [i.ingredient_id, i.quantity]));

    // 3. Filter recipes that are fully satisfiable by current inventory
    const validRecipes = recipes.filter(recipe => {
      return recipe.requirements.every(req => {
        const stock = inventory.get(req.ingredient_id) || 0;
        return stock >= req.quantity;
      });
    });

    if (validRecipes.length === 0) {
      console.log(`[RecipeSelector] No recipes available in inventory for order ${orderNumber}. Triggering stock purchase...`);
      
      // Request stock resupply via Redis Stream
      await redisClient.xAdd('stream:inventory:purchase', '*', { orderNumber });
      await client.query('ROLLBACK');
      return false; // Signal that order processing must wait/retry
    }

    // 4. Choose a random recipe from the valid ones
    const chosenRecipe = validRecipes[Math.floor(Math.random() * validRecipes.length)];

    // 5. Deduct ingredients from inventory
    for (const req of chosenRecipe.requirements) {
      await client.query(
        'UPDATE ingredients_inventory SET quantity = quantity - $1 WHERE ingredient_id = $2',
        [req.quantity, req.ingredient_id]
      );
    }

    // 6. Create order in PostgreSQL with status 'confirmed'
    const insertOrderQuery = `
      INSERT INTO orders (order_number, recipe_id, status)
      VALUES ($1, $2, 'confirmed')
      RETURNING id, order_number, recipe_id, status;
    `;
    const { rows: orderRows } = await client.query(insertOrderQuery, [orderNumber, chosenRecipe.recipe_id]);
    const newOrder = orderRows[0];

    await client.query('COMMIT');
    console.log(`[RecipeSelector] Order #${orderNumber} assigned recipe '${chosenRecipe.product}' and confirmed.`);

    // 7. Publish to Cooking Queue
    await redisClient.xAdd('stream:orders:cooking', '*', {
      orderId: newOrder.id.toString(),
      orderNumber: newOrder.order_number,
    });

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[RecipeSelector] Error processing order ${orderNumber}:`, err.message);
    return false;
  } finally {
    client.release();
  }
}

async function start() {
  await redisClient.connect();
  await redisClient.xGroupCreate('stream:orders:intake', 'recipe-group', '0', { MKSTREAM: true }).catch(() => {});
  
  console.log('[RecipeSelector] Worker started, listening on stream:orders:intake...');
  while (true) {
    try {
      const res = await redisClient.xReadGroup('recipe-group', 'worker-1', [{ key: 'stream:orders:intake', id: '>' }], { COUNT: 1, BLOCK: 5000 });
      if (res) {
        for (const stream of res) {
          for (const msg of stream.messages) {
            const { orderNumber } = msg.message;
            const success = await processIntakeOrder(orderNumber);
            if (success) {
              await redisClient.xAck('stream:orders:intake', 'recipe-group', msg.id);
            } else {
              // If failed due to inventory, delay slightly before retrying message
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
      }
    } catch (err) {
      console.error('[RecipeSelector] Loop error:', err);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}
start();