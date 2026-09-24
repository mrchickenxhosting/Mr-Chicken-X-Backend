const express = require('express');

const router = express.Router();

const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');


/* =========================================================
   LOGIN
========================================================= */

router.post(
  '/login',
  authController.login
);


/* =========================================================
   CHANGE PASSWORD
========================================================= */

router.post(
  '/change-password',
  authMiddleware,
  authController.changePassword
);


module.exports = router;