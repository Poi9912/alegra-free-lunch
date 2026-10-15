import 'dotenv/config';
import http from 'node:http';
import { handleApiRoutes } from './routers/apiRouter.js';
import { logger } from './utils/logger.js';
import { sendError } from './utils/errorHandler.js';
import { setupWebSocketServer } from './utils/websocketManager.js';
import { setupRedisEventListeners } from './utils/eventListener.js';

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

    if (parsedUrl.pathname.startsWith('/api/')) {
      return await handleApiRoutes(req, res, parsedUrl);
    }

    sendError(res, 404, 'Not Found');
  } catch (err) {
    logger.error('Unhandled server error', err);
    sendError(res, 500, 'Internal Server Error');
  }
});

setupWebSocketServer(server);

server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);

  try {
    await setupRedisEventListeners();
  } catch (err) {
    console.error('Failed to initialize Redis event listeners:', err);
  }
});