const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Use an ephemeral secret for local demos. Deployments should set JWT_SECRET so
// sessions remain valid across restarts and instances share the same key.
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d';

/**
 * Hash password using crypto.scrypt
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against salt:hash
 */
function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarColor: user.avatarColor || 'indigo'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Express middleware to authenticate JWT token
 */
function authenticateToken(req, res, next) {
  let token = null;

  // Check Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.notes_token) {
    token = req.cookies.notes_token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    req.user = decoded;
    next();
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateToken,
  JWT_SECRET
};
