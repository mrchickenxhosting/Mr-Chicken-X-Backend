module.exports = (req, res, next) => {

  // Super Admin does not need to change password
  if (req.user?.isPlatformAdmin) {
    return next();
  }

  // Password change is required
  if (req.user?.mustChangePassword) {
    return res.status(403).json({
      message: 'Password change required',
      code: 'PASSWORD_CHANGE_REQUIRED'
    });
  }

  next();
};