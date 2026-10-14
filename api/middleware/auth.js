import jwt from 'jsonwebtoken';
import { sendError } from '../utils/errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export function requireAuth(allowedRoles = []) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return sendError(res, 401, 'Unauthorized: Missing authentication token');
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return sendError(res, 403, 'Forbidden: Invalid or expired token');
      }

      // Check if roles are specified and if the user has permission
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return sendError(res, 403, 'Forbidden: You do not have permission to access this resource');
      }

      req.user = user;
      next();
    });
  };
}