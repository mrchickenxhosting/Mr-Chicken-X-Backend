const pool = require('../../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


/* =========================================================
   LOGIN
========================================================= */

exports.login = async (mobile, password) => {

  /* =======================================================
     SUPERADMIN STATIC LOGIN
  ======================================================= */

  if (
    mobile === process.env.SUPERADMIN_MOBILE &&
    password === process.env.SUPERADMIN_PASSWORD
  ) {

    const token = jwt.sign(
      {
        userId: 0,
        companyId: null,
        role: 'SUPERADMIN',
        isPlatformAdmin: true,

        // Super Admin does not need password change
        mustChangePassword: false
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );


    return {

      message: 'Super Admin login successful',

      token,

      mustChangePassword: false,

      user: {
        id: 0,
        name: 'Super Admin',
        role: 'SUPERADMIN',
        companyId: null,
        companyName: 'Platform',
        isPlatformAdmin: true,
        mustChangePassword: false
      }
    };
  }


  /* =======================================================
     NORMAL USER LOGIN
  ======================================================= */

  const userQuery = `
    SELECT 
      u.id,
      u.company_id,
      u.name,
      u.password,
      u.role,
      u.status,
      u.is_platform_admin,
      u.must_change_password,
      c.company_name
    FROM users u
    LEFT JOIN companies c
      ON c.id = u.company_id
    WHERE u.mobile = $1
  `;


  const userResult = await pool.query(
    userQuery,
    [mobile]
  );


  /* =======================================================
     USER NOT FOUND
  ======================================================= */

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }


  const user = userResult.rows[0];


  /* =======================================================
     ACCOUNT STATUS
  ======================================================= */

  if (!user.status) {
    throw new Error(
      'User account is inactive'
    );
  }


  /* =======================================================
     PASSWORD CHECK
  ======================================================= */

  const isMatch = await bcrypt.compare(
    password,
    user.password
  );


  if (!isMatch) {
    throw new Error(
      'Invalid password'
    );
  }


  /* =======================================================
     JWT TOKEN
  ======================================================= */

  const token = jwt.sign(
    {
      userId: user.id,

      companyId: user.company_id,

      role: user.role,

      isPlatformAdmin:
        user.is_platform_admin,

      mustChangePassword:
        user.must_change_password
    },

    process.env.JWT_SECRET,

    {
      expiresIn: '1d'
    }
  );


  /* =======================================================
     LOGIN RESPONSE
  ======================================================= */

  return {

    message: user.must_change_password
      ? 'Password change required'
      : 'Login successful',

    token,

    mustChangePassword:
      user.must_change_password,

    user: {

      id: user.id,

      name: user.name,

      role: user.role,

      companyId:
        user.company_id,

      companyName:
        user.company_name,

      isPlatformAdmin:
        user.is_platform_admin,

      mustChangePassword:
        user.must_change_password
    }
  };
};


/* =========================================================
   CHANGE PASSWORD
========================================================= */

exports.changePassword = async (
  userId,
  currentPassword,
  newPassword
) => {

  /* =======================================================
     GET USER
  ======================================================= */

  const userResult = await pool.query(
    `
      SELECT
        u.id,
        u.company_id,
        u.name,
        u.password,
        u.role,
        u.is_platform_admin,
        c.company_name
      FROM users u
      LEFT JOIN companies c
        ON c.id = u.company_id
      WHERE u.id = $1
    `,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];


  /* =======================================================
     VERIFY CURRENT PASSWORD
  ======================================================= */

  const isMatch = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isMatch) {
    throw new Error('Current password is incorrect');
  }


  /* =======================================================
     PREVENT SAME PASSWORD
  ======================================================= */

  const isSamePassword = await bcrypt.compare(
    newPassword,
    user.password
  );

  if (isSamePassword) {
    throw new Error(
      'New password must be different from current password'
    );
  }


  /* =======================================================
     HASH NEW PASSWORD
  ======================================================= */

  const hashedPassword = await bcrypt.hash(
    newPassword,
    10
  );


  /* =======================================================
     UPDATE PASSWORD
  ======================================================= */

  await pool.query(
    `
      UPDATE users
      SET
        password = $1,
        must_change_password = FALSE
      WHERE id = $2
    `,
    [hashedPassword, userId]
  );


  /* =======================================================
     CREATE NEW JWT
     IMPORTANT:
     Old JWT contains mustChangePassword=true.
     New JWT must contain false.
  ======================================================= */

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.company_id,
      role: user.role,
      isPlatformAdmin: user.is_platform_admin,
      mustChangePassword: false
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '1d'
    }
  );


  /* =======================================================
     RESPONSE
  ======================================================= */

  return {
    message: 'Password changed successfully',

    token,

    mustChangePassword: false,

    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
      isPlatformAdmin: user.is_platform_admin,
      mustChangePassword: false
    }
  };
};