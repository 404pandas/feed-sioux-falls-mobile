const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protects a route: requires a valid JWT in the Authorization header.
// Usage: router.get('/inventory', requireAuth, handler)
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user; // available to every route handler after this
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

// Restricts a route to admins only. Use AFTER requireAuth.
// Usage: router.post('/items', requireAuth, requireAdmin, handler)
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only.' });
  }
  next();
}

// Restricts a route to staff (admin or volunteer) - excludes neighbors.
// Use AFTER requireAuth. Covers operational routes like inventory and
// distribution events, which neighbors have no reason to touch.
// Usage: router.use(requireAuth, requireStaff)
function requireStaff(req, res, next) {
  if (req.user.role !== 'admin' && req.user.role !== 'volunteer') {
    return res.status(403).json({ error: 'Staff only.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireStaff };
