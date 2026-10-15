import { restaurantController } from '../controllers/restaurantController.js';
import { requireAuth } from '../middleware/auth.js';
import { sendError } from '../utils/errorHandler.js';

export async function handleApiRoutes(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;

  // Public: Login for users of the application
  if (pathname === '/api/login' && method === 'POST') {
    return restaurantController.login(req, res);
  }

  // Protected: Recipes
  if (pathname === '/api/recipes' && method === 'GET') {
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.getRecipes(req, res));
  }

  // Protected: Inventory
  if (pathname === '/api/inventory' && method === 'GET') {
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.getInventory(req, res));
  }

  // Protected: Purchase History
  if (pathname === '/api/purchases' && method === 'GET') {
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.getPurchaseHistory(req, res));
  }

  // Protected: View Orders
  if (pathname === '/api/orders' && method === 'GET') {
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.getOrders(req, res));
  }

  // Protected: Create Batch Orders (Manager Only - replaces single order creation)
  if (pathname === '/api/orders' && method === 'POST') {
    return requireAuth(['manager'])(req, res, () => restaurantController.createBatchOrders(req, res));
  }

  // Protected: Dashboard Status
  if (pathname === '/api/status' && method === 'GET') {
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.getStatus(req, res));
  }

  // Protected: Update Order Status
  const orderStatusMatch = pathname.match(/^\/api\/orders\/(\d+)\/status$/);
  if (orderStatusMatch && method === 'PATCH') {
    const orderId = orderStatusMatch[1];
    return requireAuth(['manager', 'operation'])(req, res, () => restaurantController.updateOrderStatus(req, res, orderId));
  }

  // Default if not handled
  return sendError(res, 404, 'Endpoint not found');
}