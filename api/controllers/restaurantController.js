import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbPool, redisClient } from '../utils/db.js';
import { getOrSetCache } from '../utils/cacheHelper.js';
import { sendError } from '../utils/errorHandler.js';
import { parseJsonBody } from '../utils/parser.js';
import { logger } from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const restaurantController = {
  // Manager & Operation Login
  login: async (req, res) => {
    try {
      const { username, password } = await parseJsonBody(req);
      const { rows } = await dbPool.query(
        'SELECT id, username, password_hash, role FROM users WHERE username = $1',
        [username]
      );

      if (rows.length === 0 || !(await bcrypt.compare(password, rows[0].password_hash))) {
        return sendError(res, 401, 'Invalid credentials');
      }

      const user = rows[0];
      const token = jwt.sign(
        { userId: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, token, role: user.role }));
    } catch (err) {
      logger.error('Login error', err);
      sendError(res, 500, 'Internal server error');
    }
  },

  // Get cached recipes
  getRecipes: async (req, res) => {
    try {
      const recipes = await getOrSetCache('cache:recipes:all', 300, async () => {
        const query = `
          SELECT r.id, r.product, 
                 json_agg(json_build_object('ingredient_id', i.id, 'ingredient_name', i.name, 'quantity', ri.quantity)) AS ingredients
          FROM recipes r
          JOIN recipe_ingredients ri ON r.id = ri.recipe_id
          JOIN ingredients i ON ri.ingredient_id = i.id
          GROUP BY r.id, r.product;
        `;
        const { rows } = await dbPool.query(query);
        return rows;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: recipes }));
    } catch (err) {
      logger.error('Get recipes error', err);
      sendError(res, 500, err.message);
    }
  },

  // Get inventory status
  getInventory: async (req, res) => {
    try {
      const inventory = await getOrSetCache('cache:inventory:status', 60, async () => {
        const query = `
          SELECT inv.id, i.id AS ingredient_id, i.name AS ingredient_name, inv.quantity
          FROM ingredients_inventory inv
          JOIN ingredients i ON inv.ingredient_id = i.id;
        `;
        const { rows } = await dbPool.query(query);
        return rows;
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: inventory }));
    } catch (err) {
      logger.error('Get inventory error', err);
      sendError(res, 500, err.message);
    }
  },

  // Get purchase history
  getPurchaseHistory: async (req, res) => {
    try {
      const query = `
        SELECT ph.id, i.name AS ingredient_name, ph.quantity, ph.purchased_at
        FROM inventory_purchase_history ph
        JOIN ingredients i ON ph.ingredient_id = i.id
        ORDER BY ph.purchased_at DESC
        LIMIT 50;
      `;
      const { rows } = await dbPool.query(query);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
      logger.error('Get purchase history error', err);
      sendError(res, 500, err.message);
    }
  },

  // Get orders list
  getOrders: async (req, res) => {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const statusParam = urlObj.searchParams.get('status');

      let query = `
        SELECT o.id, o.order_number, r.product, o.status, o.created_at, o.updated_at
        FROM orders o
        JOIN recipes r ON o.recipe_id = r.id
      `;
      let queryParams = [];

      if (statusParam) {
        query += ` WHERE o.status = $1`;
        queryParams.push(statusParam);
      }

      query += ` ORDER BY o.created_at DESC LIMIT 100;`;

      const { rows } = await dbPool.query(query, queryParams);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows }));
    } catch (err) {
      logger.error('Get orders error', err);
      sendError(res, 500, err.message);
    }
  },

  // Update order status (Kitchen staff or Manager)
  updateOrderStatus: async (req, res, orderId) => {
    try {
      const { status } = await parseJsonBody(req);
      const validStatuses = ['created', 'confirmed', 'cooking', 'ready', 'delivered'];
      
      if (!validStatuses.includes(status)) {
        return sendError(res, 400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }

      const query = `
        UPDATE orders 
        SET status = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $2 
        RETURNING id, order_number, status, updated_at;
      `;
      const { rows } = await dbPool.query(query, [status, orderId]);

      if (rows.length === 0) {
        return sendError(res, 404, 'Order not found');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: rows[0] }));
    } catch (err) {
      logger.error('Update order status error', err);
      sendError(res, 500, err.message);
    }
  },

  // NEW: Batch Order Generation (Manager only)
  createBatchOrders: async (req, res) => {
    try {
      const { count } = await parseJsonBody(req);
      const orderCount = parseInt(count, 10) || 1;

      const batchId = `batch-${Date.now()}`;
      logger.info(`Manager requested batch of ${orderCount} orders (Batch ID: ${batchId})`);

      for (let i = 0; i < orderCount; i++) {
        const orderNumber = `ORD-${Date.now()}-${i + 1}`;
        await redisClient.xAdd('stream:orders:intake', '*', {
          orderNumber,
          batchId,
        });
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Successfully queued ${orderCount} orders for processing.` }));
    } catch (err) {
      logger.error('Create batch orders error', err);
      sendError(res, 400, err.message);
    }
  },

  // Get full dashboard status
  getStatus: async (req, res) => {
    try {
      const [inventoryRes, recipesRes, ordersRes, historyRes] = await Promise.all([
        dbPool.query(`SELECT inv.id, i.id AS ingredient_id, i.name AS ingredient_name, inv.quantity FROM ingredients_inventory inv JOIN ingredients i ON inv.ingredient_id = i.id;`),
        dbPool.query(`SELECT r.id, r.product, json_agg(json_build_object('ingredient_id', i.id, 'ingredient_name', i.name, 'quantity', ri.quantity)) AS ingredients FROM recipes r JOIN recipe_ingredients ri ON r.id = ri.recipe_id JOIN ingredients i ON ri.ingredient_id = i.id GROUP BY r.id, r.product;`),
        dbPool.query(`SELECT o.id, o.order_number, r.product, o.status, o.created_at FROM orders o JOIN recipes r ON o.recipe_id = r.id ORDER BY o.created_at DESC LIMIT 50;`),
        dbPool.query(`SELECT ph.id, i.name AS ingredient_name, ph.quantity, ph.purchased_at FROM inventory_purchase_history ph JOIN ingredients i ON ph.ingredient_id = i.id ORDER BY ph.purchased_at DESC LIMIT 20;`)
      ]);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: {
          inventory: inventoryRes.rows,
          recipes: recipesRes.rows,
          orders: ordersRes.rows,
          purchaseHistory: historyRes.rows
        }
      }));
    } catch (err) {
      logger.error('Get status error', err);
      sendError(res, 500, err.message);
    }
  }
};