const jwt = require('jsonwebtoken');

/**
 * Middleware to protect routes.
 * It checks for a valid JWT in the Authorization header, verifies it,
 * and attaches the user payload to the request object.
 */
const protect = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (e.g., "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user to the request object, excluding the JWT timestamps
      req.user = { id: decoded.id, role: decoded.role };

      next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
};

/**
 * Middleware for role-based authorization.
 * @param {...string} roles - A list of roles that are allowed to access the route.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // Add server-side logging to help debug authorization failures. This will clearly show if the wrong token is being sent.
      console.error(`Authorization Failed: Route requires role(s) [${roles.join(', ')}], but user token has role '${req.user?.role}'.`);
      return res.status(403).json({ message: `Forbidden: You do not have the required role(s) (${roles.join(', ')}) to access this resource.` });
    }
    next();
  };
};

module.exports = { protect, authorize };