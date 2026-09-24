const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: 'Token missing'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        message: 'Invalid token format'
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = {
      userId: decoded.userId,
      companyId: decoded.companyId,
      role: decoded.role,
      isPlatformAdmin: decoded.isPlatformAdmin,
      mustChangePassword: decoded.mustChangePassword || false
    };

    next();

  } catch (err) {
    console.error('Auth Middleware Error:', err);

    return res.status(401).json({
      message: 'Invalid or expired token'
    });
  }
};