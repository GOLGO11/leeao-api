const crypto = require('crypto');

// 密码哈希
async function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 验证密码
async function verifyPassword(password, hash) {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// 生成Token
function generateToken(userId) {
  const payload = `${userId}:${Date.now()}`;
  return Buffer.from(payload).toString('base64');
}

// 验证Token
function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId, timestamp] = decoded.split(':');
    const tokenAge = Date.now() - parseInt(timestamp);
    // Token有效期7天
    if (tokenAge > 7 * 24 * 60 * 60 * 1000) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

// 认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const token = authHeader.substring(7);
  const userId = verifyToken(token);
  
  if (!userId) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.userId = userId;
  next();
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  authMiddleware
};
