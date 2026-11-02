const jwt = require('jsonwebtoken');
const User = require('../models/User');

// The active user a login token belongs to, or null (missing, expired, or
// tampered token; deactivated or deleted person; or a login made before
// their PIN was last changed). Logins from before sessionVersion existed
// have no `sv` and count as version 0.
async function userFromToken(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || !user.active) return null;
    if ((payload.sv || 0) !== (user.sessionVersion || 0)) return null;
    return user;
  } catch {
    return null;
  }
}

function tokenFrom(req) {
  const authHeader = req.headers.authorization || '';
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
}

// Protects a route: requires a valid JWT in the Authorization header.
// Usage: router.get('/inventory', requireAuth, handler)
async function requireAuth(req, res, next) {
  const token = tokenFrom(req);
  if (!token) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  const user = await userFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Your login has ended (expired, PIN changed, or access removed). Please log in again.' });
  }
  req.user = user; // available to every route handler after this
  next();
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

module.exports = { requireAuth, requireAdmin, requireStaff, userFromToken, tokenFrom };
