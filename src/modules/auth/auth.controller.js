const authService = require('./auth.service');


/* =========================================================
   LOGIN
========================================================= */

exports.login = async (req, res) => {
  try {

    const {
      mobile,
      password
    } = req.body;


    /* ================= VALIDATION ================= */

    if (!mobile || !password) {
      return res.status(400).json({
        message: 'Mobile and password are required'
      });
    }


    /* ================= LOGIN ================= */

    const result = await authService.login(
      mobile,
      password
    );


    return res.status(200).json(result);

  } catch (error) {

    console.error('Login Error:', error);

    return res.status(401).json({
      message: error.message || 'Invalid credentials'
    });
  }
};


/* =========================================================
   CHANGE PASSWORD
========================================================= */

exports.changePassword = async (req, res) => {
  try {

    const {
      currentPassword,
      newPassword
    } = req.body;


    /* ================= VALIDATION ================= */

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          'Current password and new password are required'
      });
    }


    /* ================= PASSWORD LENGTH ================= */

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          'New password must be at least 6 characters long'
      });
    }


    /* ================= USER ID ================= */

    const userId = req.user.userId;


    if (!userId) {
      return res.status(401).json({
        message: 'Unauthorized'
      });
    }


    /* ================= CHANGE PASSWORD ================= */

    const result = await authService.changePassword(
      userId,
      currentPassword,
      newPassword
    );


    return res.status(200).json(result);

  } catch (error) {

    console.error('Change Password Error:', error);

    return res.status(400).json({
      message:
        error.message || 'Failed to change password'
    });
  }
};