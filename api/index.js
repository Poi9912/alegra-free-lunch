import 'dotenv/config';
import http from 'node:http';
import { handleApiRoutes } from './routers/apiRouter.js';
import { logger } from './utils/logger.js';
import { sendError } from './utils/errorHandler.js';

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

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});