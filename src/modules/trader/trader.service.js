const pool = require('../../config/db');
const bcrypt = require('bcrypt');

/* ========= COMMON USER (MANAGER / DRIVER / LIFTER) ========= */
exports.createUser = async (companyId, { name, mobile, password }, role) => {
  if (!name || !mobile || !password) throw new Error('All fields required');

  const exists = await pool.query(
    'SELECT id FROM users WHERE mobile=$1',
    [mobile]
  );
  if (exists.rows.length) throw new Error('Mobile already exists');

  const hash = await bcrypt.hash(password, 10);

  const res = await pool.query(`
    INSERT INTO users (company_id, name, mobile, password, role)
    VALUES ($1,$2,$3,$4,$5)
    RETURNING id,name,mobile
  `, [companyId, name, mobile, hash, role]);

  return { message: `${role} created`, user: res.rows[0] };
};

exports.getUsers = async (companyId, role) => {
  const res = await pool.query(`
    SELECT id,name,mobile,status,created_at
    FROM users
    WHERE company_id=$1 AND role=$2
    ORDER BY created_at DESC
  `, [companyId, role]);
  return res.rows;
};

exports.updateUserStatus = async (companyId, userId, status, role) => {
  if (typeof status !== 'boolean') throw new Error('Invalid status');

  const res = await pool.query(`
    UPDATE users SET status=$1
    WHERE id=$2 AND company_id=$3 AND role=$4
    RETURNING id
  `, [status, userId, companyId, role]);

  if (!res.rows.length) throw new Error(`${role} not found`);
  return { message: `${role} ${status ? 'enabled' : 'disabled'}` };
};

exports.updateUser = async (companyId, userId, data, role) => {
  const { name, mobile } = data;

  if (!name && !mobile) {
    throw new Error('Nothing to update');
  }

  // Mobile uniqueness check (if changed)
  if (mobile) {
    const exists = await pool.query(
      'SELECT id FROM users WHERE mobile=$1 AND id<>$2',
      [mobile, userId]
    );
    if (exists.rows.length) throw new Error('Mobile already exists');
  }

  const res = await pool.query(
    `
    UPDATE users
    SET
      name = COALESCE($1, name),
      mobile = COALESCE($2, mobile)
    WHERE id=$3 AND company_id=$4 AND role=$5
    RETURNING id,name,mobile
    `,
    [name, mobile, userId, companyId, role]
  );

  if (!res.rows.length) {
    throw new Error(`${role} not found`);
  }

  return {
    message: `${role} updated successfully`,
    user: res.rows[0],
  };
};

exports.deleteUser = async (companyId, userId, role) => {
  const res = await pool.query(
    `
    DELETE FROM users
    WHERE id=$1 AND company_id=$2 AND role=$3
    RETURNING id
    `,
    [userId, companyId, role]
  );

  if (!res.rows.length) {
    throw new Error(`${role} not found`);
  }

  return {
    message: `${role} deleted successfully`,
  };
};


/* ========= FARMERS ========= */
exports.createFarmer = async (companyId, { name, mobile, farms }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (!name || !name.trim()) {
      throw new Error('Farmer name is required');
    }

    if (!farms || farms.length === 0) {
      throw new Error('At least one farm is required');
    }

    // 1️⃣ Insert Farmer
    const farmerRes = await client.query(
      `
      INSERT INTO farmers (company_id, name, mobile)
      VALUES ($1,$2,$3)
      RETURNING id, name, mobile
      `,
      [companyId, name.trim(), mobile || null]
    );

    const farmer = farmerRes.rows[0];

    // 2️⃣ Insert Farms
    for (const farm of farms) {
      if (!farm.location || !farm.location.trim()) {
        continue; // skip empty farms
      }

      await client.query(
        `
        INSERT INTO farms (farmer_id, location, latitude, longitude)
        VALUES ($1,$2,$3,$4)
        `,
        [
          farmer.id,
          farm.location.trim(),
          farm.latitude || null,
          farm.longitude || null,
        ]
      );
    }

    await client.query('COMMIT');

    return {
      message: 'Farmer added successfully',
      farmer,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};


exports.getFarmers = async (companyId) => {
  const res = await pool.query(
    `
    SELECT 
      f.id AS farmer_id,
      f.name AS farmer_name,
      f.mobile,
      f.status,
      f.created_at,
      fa.id AS farm_id,
      fa.location,
      fa.latitude,
      fa.longitude
    FROM farmers f
    LEFT JOIN farms fa ON fa.farmer_id = f.id
    WHERE f.company_id = $1
    ORDER BY f.created_at DESC
    `,
    [companyId]
  );

  // Group farms under farmer
  const farmersMap = {};

  for (const row of res.rows) {
    if (!farmersMap[row.farmer_id]) {
      farmersMap[row.farmer_id] = {
        id: row.farmer_id,
        name: row.farmer_name,
        mobile: row.mobile,
        status: row.status,
        created_at: row.created_at,
        farms: [],
      };
    }

    if (row.farm_id) {
      farmersMap[row.farmer_id].farms.push({
        id: row.farm_id,
        name: row.farm_name,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
      });
    }
  }

  return Object.values(farmersMap);
};

exports.updateFarmer = async (
  companyId,
  farmerId,
  { name, mobile, farms }
) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1️⃣ Check farmer exists
    const check = await client.query(
      `SELECT id FROM farmers WHERE id=$1 AND company_id=$2`,
      [farmerId, companyId]
    );

    if (!check.rows.length) {
      throw new Error('Farmer not found');
    }

    // 2️⃣ Update farmer basic info
    await client.query(
      `
      UPDATE farmers
      SET
        name = COALESCE($1, name),
        mobile = COALESCE($2, mobile)
      WHERE id=$3 AND company_id=$4
      `,
      [name, mobile, farmerId, companyId]
    );

    // 3️⃣ Delete old farms
    await client.query(
      `DELETE FROM farms WHERE farmer_id=$1`,
      [farmerId]
    );

    // 4️⃣ Insert new farms
    if (farms && farms.length > 0) {
      for (const farm of farms) {
        await client.query(
          `
          INSERT INTO farms (farmer_id, location, latitude, longitude)
          VALUES ($1,$2,$3,$4)
          `,
          [
            farmerId,
            farm.location,
            farm.latitude,
            farm.longitude,
          ]
        );
      }
    }

    await client.query('COMMIT');

    return {
      message: 'Farmer updated successfully',
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

exports.updateFarmLocation = async (
  companyId,
  farmId,
  { latitude, longitude }
) => {
  const res = await pool.query(
    `
    UPDATE farms f
    SET latitude=$1,
        longitude=$2
    FROM farmers fr
    WHERE f.id=$3
      AND f.farmer_id = fr.id
      AND fr.company_id=$4
    RETURNING f.id
    `,
    [latitude, longitude, farmId, companyId]
  );

  if (!res.rows.length) {
    throw new Error('Farm not found');
  }

  return {
    message: 'Farm location updated successfully',
  };
};

exports.updateFarmerStatus = async (companyId, farmerId, status) => {
  if (typeof status !== 'boolean') {
    throw new Error('Invalid status');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1️⃣ Update Farmer
    const farmerRes = await client.query(
      `
      UPDATE farmers
      SET status = $1
      WHERE id = $2 AND company_id = $3
      RETURNING id
      `,
      [status, farmerId, companyId]
    );

    if (!farmerRes.rows.length) {
      throw new Error('Farmer not found');
    }

    // 2️⃣ Update All Related Farms
    await client.query(
      `
      UPDATE farms
      SET status = $1
      WHERE farmer_id = $2
      `,
      [status, farmerId]
    );

    await client.query('COMMIT');

    return {
      message: `Farmer ${status ? 'enabled' : 'disabled'} successfully`,
    };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteFarmer = async (companyId, farmerId) => {
  const res = await pool.query(
    `
    DELETE FROM farmers
    WHERE id=$1 AND company_id=$2
    RETURNING id
    `,
    [farmerId, companyId]
  );

  if (!res.rows.length) throw new Error('Farmer not found');

  return {
    message: 'Farmer deleted successfully',
  };
};

/* ========= CUSTOMERS ========= */
// helper: safely convert to number
const normalizeNumber = (value, defaultVal = 0) => {
  if (value === '' || value === null || value === undefined) return defaultVal;
  const num = Number(value);
  return Number.isNaN(num) ? defaultVal : num;
};

const generateCustomerCode = async () => {
  const res = await pool.query(
    `SELECT nextval('customer_code_seq') AS seq`
  );
  return `CUST-${String(res.rows[0].seq).padStart(5, '0')}`;
};


exports.createCustomer = async (companyId, data) => {
  const {
    name,
    shop_name,
    mobile,
    alternate_mobile,
    city,
    address,
    customer_type,
    credit_limit,
    credit_days,
    block_on_limit,
    payment_mode,
    upi_number,
    opening_balance,
    has_outstanding,
  } = data;

  if (!name || !mobile) {
    throw new Error('Name and mobile are required');
  }

  const outstanding =
    has_outstanding ? normalizeNumber(opening_balance) : 0;

  // 🔥 generate unique customer code
  const customerCode = await generateCustomerCode();

  const res = await pool.query(
    `
    INSERT INTO customers (
      company_id,
      customer_code,
      name,
      shop_name,
      mobile,
      alternate_mobile,
      city,
      address,
      customer_type,
      credit_limit,
      credit_days,
      block_on_limit,
      payment_mode,
      upi_number,
      outstanding
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
    )
    RETURNING *
    `,
    [
      companyId,
      customerCode,
      name,
      shop_name || null,
      mobile,
      alternate_mobile || null,
      city || null,
      address || null,
      customer_type || 'GREEN',
      normalizeNumber(credit_limit),
      normalizeNumber(credit_days),
      block_on_limit ?? true,
      payment_mode || 'CASH',
      upi_number || null,
      outstanding,
    ]
  );

  return {
    message: 'Customer added successfully',
    customer: res.rows[0],
  };
};


exports.getCustomers = async (companyId) => {
  const res = await pool.query(
    'SELECT * FROM customers WHERE company_id=$1 ORDER BY created_at DESC',
    [companyId]
  );
  return res.rows;
};

exports.updateCustomer = async (companyId, customerId, data) => {
  const {
    name,
    shop_name,
    mobile,
    alternate_mobile,
    city,
    address,
    customer_type,
    credit_limit,
    credit_days,
    block_on_limit,
    payment_mode,
    upi_number,
    has_outstanding,
    opening_balance,
  } = data;

  let outstandingValue = null;
  let updateOutstanding = false;

  if (has_outstanding === true) {
    outstandingValue = Number(opening_balance) || 0;
    updateOutstanding = true;
  }

  if (has_outstanding === false) {
    outstandingValue = 0;
    updateOutstanding = true;
  }

  const res = await pool.query(
    `
    UPDATE customers
    SET
      name = COALESCE($1, name),
      shop_name = COALESCE($2, shop_name),
      mobile = COALESCE($3, mobile),
      alternate_mobile = COALESCE($4, alternate_mobile),
      city = COALESCE($5, city),
      address = COALESCE($6, address),
      customer_type = COALESCE($7, customer_type),
      credit_limit = COALESCE($8, credit_limit),
      credit_days = COALESCE($9, credit_days),
      block_on_limit = COALESCE($10, block_on_limit),
      payment_mode = COALESCE($11, payment_mode),
      upi_number = COALESCE($12, upi_number),
      outstanding = CASE
        WHEN $13 = true THEN $14
        ELSE outstanding
      END
    WHERE id=$15 AND company_id=$16
    RETURNING *
    `,
    [
      name,
      shop_name,
      mobile,
      alternate_mobile,
      city,
      address,
      customer_type,
      credit_limit !== undefined ? Number(credit_limit) : null,
      credit_days !== undefined ? Number(credit_days) : null,
      block_on_limit,
      payment_mode,
      upi_number,
      updateOutstanding,
      outstandingValue,
      customerId,
      companyId,
    ]
  );

  if (!res.rows.length) {
    throw new Error('Customer not found');
  }

  return {
    message: 'Customer updated successfully',
    customer: res.rows[0],
  };
};


exports.deleteCustomer = async (companyId, customerId) => {
  const res = await pool.query(
    `
    DELETE FROM customers
    WHERE id=$1 AND company_id=$2
    RETURNING id
    `,
    [customerId, companyId]
  );

  if (!res.rows.length) throw new Error('Customer not found');

  return {
    message: 'Customer deleted successfully',
  };
};

/**
 * NOTE:
 * Outstanding will later be calculated from SALES table.
 * Keeping this temporarily to avoid breaking existing API.
 */
exports.getCustomerOutstanding = async (companyId, customerId) => {
  const res = await pool.query(`
    SELECT 
      COALESCE(SUM(amount - paid_amount),0) AS outstanding
    FROM sales
    WHERE customer_id=$1
  `, [customerId]);

  return { customerId, outstanding: res.rows[0].outstanding };
};

exports.getAllCustomersOutstanding = async (companyId) => {

  const result = await pool.query(`
    SELECT
      id AS customer_id,
      name,
      mobile,
      outstanding,
      customer_type

    FROM customers
    WHERE company_id = $1
    ORDER BY outstanding DESC
  `, [companyId]);

  return result.rows;
};


/* ========= TRIPS (ORDERS TABLE) ========= */

/**
 * Assign trip: Trader/Manager assigns driver to farmer
 */
exports.createTrip = async (companyId, data) => {
  let {
    farm_id,
    driver_id,
    lifter_id,
    total_birds,
    trip_time,
    trip_date,
    contact_name,
    contact_phone,
  } = data;

  // 🔥 Convert IDs to numbers
  farm_id = Number(farm_id);
  driver_id = Number(driver_id);

  // ✅ Safer validation
  if (
    !farm_id ||
    !driver_id ||
    !trip_date ||
    !trip_time
  ) {
    throw new Error('Farm, Driver, Date and Time are required');
  }

  if (contact_phone && contact_phone.length !== 10) {
    throw new Error('Contact phone must be 10 digits');
  }

  const result = await pool.query(
    `
    INSERT INTO trips (
      company_id,
      farm_id,
      driver_id,
       lifter_id,   
      total_birds,
      trip_time,
      trip_date,
      contact_name,
      contact_phone
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
    `,
    [
      companyId,
      farm_id,
      driver_id,
      lifter_id,     // ✅ ADD
      total_birds || 0,
      trip_time,
      trip_date,
      contact_name || null,
      contact_phone || null,
    ]
  );

  return result.rows[0];
};

exports.getTrips = async (companyId) => {
  const res = await pool.query(`
    SELECT
      t.id,
      t.company_id,

      -- Farm Info
      t.farm_id,
      fa.location AS farm_location,
      fa.latitude AS farm_latitude,
      fa.longitude AS farm_longitude,

      -- Farmer Info (via farm)
      f.id AS farmer_id,
      f.name AS farmer_name,
      f.mobile AS farmer_mobile,

      -- Driver Info
      t.driver_id,
      u.name AS driver_name,
      u.mobile AS driver_mobile,

      -- Lifter Info
      t.lifter_id,
      lifter.name AS lifter_name,
      lifter.mobile AS lifter_mobile,

      -- Trip Details
      t.total_birds,
      t.trip_date,
      t.trip_time,
      t.total_weight,

      -- Contact Person
      t.contact_name,
      t.contact_phone,

      -- Status Info
      t.status,
      t.is_verified,
      t.created_at,
      t.closed_at

    FROM trips t

    -- Join farm directly
    LEFT JOIN farms fa ON fa.id = t.farm_id

    -- Join farmer via farm
    LEFT JOIN farmers f ON f.id = fa.farmer_id

    -- Join driver
    LEFT JOIN users u ON u.id = t.driver_id

    -- Join Lifter
    LEFT JOIN users lifter ON lifter.id = t.lifter_id

    WHERE t.company_id = $1

    ORDER BY t.trip_date DESC, t.trip_time DESC
  `, [companyId]);

  return res.rows;
};

exports.updateTrip = async (companyId, tripId, data) => {
  const {
    farm_id,
    driver_id,
    lifter_id,   // ✅ ADD
    total_birds,
    trip_date,
    trip_time,
    contact_name,
    contact_phone,
  } = data;

  if (contact_phone && contact_phone.length !== 10) {
    throw new Error('Contact phone must be 10 digits');
  }

  const res = await pool.query(
    `
    UPDATE trips
    SET
      farm_id = COALESCE($1, farm_id),
      driver_id = COALESCE($2, driver_id),
      lifter_id = COALESCE($4, lifter_id),   
      total_birds = COALESCE($4, total_birds),
      trip_date = COALESCE($5, trip_date),
      trip_time = COALESCE($6, trip_time),
      contact_name = COALESCE($7, contact_name),
      contact_phone = COALESCE($8, contact_phone)
    WHERE id = $9
      AND company_id = $10
      AND status != 'CLOSED'
    RETURNING *
    `,
    [
      farm_id,
      driver_id,
      lifter_id,
      total_birds,
      trip_date,
      trip_time,
      contact_name || null,
      contact_phone || null,
      tripId,
      companyId,
    ]
  );

  if (!res.rows.length) {
    throw new Error('Trip not found or already closed');
  }

  return {
    message: 'Trip updated successfully',
    trip: res.rows[0],
  };
};

exports.deleteTrip = async (companyId, tripId) => {
  const res = await pool.query(
    `
    DELETE FROM trips
    WHERE id = $1
      AND company_id = $2
      AND status != 'CLOSED'
    RETURNING id
    `,
    [tripId, companyId]
  );

  if (!res.rows.length) {
    throw new Error('Trip not found or already closed');
  }

  return {
    message: 'Trip deleted successfully',
  };
};

/* ========= SALES (MANAGER VIEW) ========= */

exports.getTripSales = async (companyId, tripId) => {
  const res = await pool.query(`
    SELECT
      s.id,
      s.trip_id,
      s.customer_id,
      c.name AS customer_name,
      s.cage_number,
      s.sell_type,
      s.bird_count,
      s.weight,
      s.rate,
      s.total_amount,
      s.payment_mode,
      COALESCE(s.cash_amount, 0) AS cash_amount,
      COALESCE(s.upi_amount, 0) AS upi_amount,
      s.created_at
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    JOIN trips t ON t.id = s.trip_id
    WHERE s.trip_id = $1
      AND t.company_id = $2
    ORDER BY s.cage_number, s.created_at ASC
  `, [tripId, companyId]);

  return res.rows;
};


/* ========= DAY CLOSE ========= */

exports.closeDay = async (
  companyId,
  tripId,
  {
    diesel_expense = 0,
    other_expense = 0,
    driver_expense = 0,
    purchase_rate_per_kg = 0,
  }
) => {
  // 1️⃣ Check trip exists
  const tripRes = await pool.query(
    `
    SELECT status
    FROM trips
    WHERE id = $1
      AND company_id = $2
  `,
    [tripId, companyId]
  );

  if (!tripRes.rows.length) {
    throw new Error('Trip not found');
  }

  const tripStatus = tripRes.rows[0].status;

  if (tripStatus === 'CLOSED') {
    throw new Error('Trip already closed');
  }

  if (tripStatus !== 'LIFTED') {
    throw new Error('Trip is not ready to close');
  }

  // 2️⃣ Save expenses (trip-based)
  await pool.query(
    `
    INSERT INTO expenses (
      trip_id,
      diesel_expense,
      other_expense,
      driver_expense,
      purchase_rate_per_kg,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, NOW())
  `,
    [
      tripId,
      diesel_expense,
      other_expense,
      driver_expense,
      purchase_rate_per_kg,
    ]
  );

  // 3️⃣ Close trip
  await pool.query(
    `
    UPDATE trips
    SET status = 'CLOSED',
        closed_at = NOW()
    WHERE id = $1
  `,
    [tripId]
  );

  return { message: 'Day closed successfully' };
};
exports.getTripExpenses = async (companyId, tripId) => {

  const result = await pool.query(
    `SELECT 
        id,
        diesel_expense,
        driver_expense,
        other_expense,
        purchase_rate_per_kg,
        created_at
     FROM expenses
     WHERE trip_id = $1
     ORDER BY created_at ASC`,
    [tripId]
  );

  return result.rows;
};


/* ========= DASHBOARD ========= */
exports.getDashboard = async (companyId) => {
  const [
    countsResult,
    weeklySalesResult,
    paymentSplitResult,
    tripStatusResult,
  ] = await Promise.all([
    // ===================== SUMMARY COUNTS =====================
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE company_id = $1 AND role = 'DRIVER') AS total_drivers,
        (SELECT COUNT(*) FROM farmers WHERE company_id = $1) AS total_farmers,
        (SELECT COUNT(*) FROM customers WHERE company_id = $1) AS total_customers,
        (SELECT COUNT(*) FROM trips WHERE company_id = $1 AND status != 'CLOSED') AS active_trips
    `, [companyId]),

    // ===================== WEEKLY SALES =====================
    pool.query(`
      SELECT
        DATE(s.created_at) AS sale_date,
        SUM(s.total_amount) AS total_sales,
        SUM(COALESCE(s.cash_amount, 0) + COALESCE(s.upi_amount, 0)) AS total_collected
      FROM sales s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.company_id = $1
        AND s.created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(s.created_at)
      ORDER BY sale_date
    `, [companyId]),

    // ===================== PAYMENT SPLIT =====================
    pool.query(`
      SELECT 'CASH' AS payment_mode,
             SUM(COALESCE(s.cash_amount, 0)) AS total_amount
      FROM sales s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.company_id = $1

      UNION ALL

      SELECT 'UPI' AS payment_mode,
             SUM(COALESCE(s.upi_amount, 0)) AS total_amount
      FROM sales s
      JOIN trips t ON t.id = s.trip_id
      WHERE t.company_id = $1
    `, [companyId]),

    // ===================== TRIP STATUS =====================
    pool.query(`
  SELECT
    status,
    COUNT(*) AS count,
    MAX(
      CASE
        WHEN status = 'CLOSED' THEN closed_at
        ELSE created_at
      END
    ) AS action_time
  FROM trips
  WHERE company_id = $1
  GROUP BY status
    `, [companyId])
  ]);

  return {
    summary: countsResult.rows[0],
    weeklySales: weeklySalesResult.rows,
    paymentSplit: paymentSplitResult.rows,
    tripStatus: tripStatusResult.rows
  };
};


exports.creditCustomer = async (companyId, customerId, amount) => {

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 🔒 Lock row
    const customerRes = await client.query(
      `
      SELECT outstanding 
      FROM customers 
      WHERE id = $1 AND company_id = $2
      FOR UPDATE
      `,
      [customerId, companyId]
    );

    if (customerRes.rows.length === 0) {
      throw new Error('Customer not found');
    }

    const currentOutstanding = Number(customerRes.rows[0].outstanding);

    if (amount > currentOutstanding) {
      throw new Error('Credit amount cannot exceed outstanding');
    }

    const newOutstanding = currentOutstanding - amount;

    // ✅ Update outstanding
    const updateRes = await client.query(
      `
      UPDATE customers
      SET outstanding = $1
      WHERE id = $2
      RETURNING id, name, outstanding
      `,
      [newOutstanding, customerId]
    );

    await client.query('COMMIT');

    return {
      message: 'Credit applied successfully',
      customer: updateRes.rows[0],
    };

  } catch (error) {

    await client.query('ROLLBACK');
    throw error;

  } finally {
    client.release();
  }
};


exports.getSalesReport = async (companyId, filters) => {
  const {
    startDate,
    endDate,
    customerId,
    farmerId,
    driverId,
    groupBy,
  } = filters;

  let groupSelect = '';
  let groupBySQL = '';
  let orderBy = '';

  switch (groupBy) {

    // ================= DATE WISE =================
    case 'DATE':
      groupSelect = `
        s.created_at::date AS group_key
      `;
      groupBySQL = `
        GROUP BY s.created_at::date
      `;
      orderBy = `group_key DESC`;
      break;

    // ================= CUSTOMER WISE =================
    case 'CUSTOMER':
      groupSelect = `
        c.id AS group_id,
        c.name AS group_key
      `;
      groupBySQL = `
        GROUP BY c.id, c.name
      `;
      orderBy = `group_key ASC`;
      break;

    // ================= FARMER WISE =================
    case 'FARMER':
      groupSelect = `
        f.id AS group_id,
        f.name AS group_key
      `;
      groupBySQL = `
        GROUP BY f.id, f.name
      `;
      orderBy = `group_key ASC`;
      break;

    // ================= DRIVER WISE =================
    case 'DRIVER':
      groupSelect = `
        u.id AS group_id,
        u.name AS group_key
      `;
      groupBySQL = `
        GROUP BY u.id, u.name
      `;
      orderBy = `group_key ASC`;
      break;

    // ================= OVERALL SUMMARY =================
    default:
      groupSelect = `
        'ALL' AS group_key
      `;
      groupBySQL = '';
      orderBy = '';
      break;
  }

  const query = `
    SELECT

      ${groupSelect},

      COUNT(s.id) AS total_transactions,

      COALESCE(SUM(s.total_amount),0) AS total_sales,

      COALESCE(SUM(s.cash_amount),0) AS cash_received,

      COALESCE(SUM(s.upi_amount),0) AS upi_received,

      COALESCE(
        SUM(s.total_amount)
        -
        SUM(COALESCE(s.cash_amount,0) + COALESCE(s.upi_amount,0)),
        0
      ) AS pending_amount

    FROM sales s

    JOIN trips t ON t.id = s.trip_id
    JOIN customers c ON c.id = s.customer_id
    JOIN farmers f ON f.id = t.farmer_id
    JOIN users u ON u.id = t.driver_id

    WHERE t.company_id = $1

      AND ($2::date IS NULL OR s.created_at::date >= $2)
      AND ($3::date IS NULL OR s.created_at::date <= $3)
      AND ($4::int IS NULL OR s.customer_id = $4)
      AND ($5::int IS NULL OR t.farmer_id = $5)
      AND ($6::int IS NULL OR t.driver_id = $6)

    ${groupBySQL}

    ${orderBy ? `ORDER BY ${orderBy}` : ''}
  `;

  const res = await pool.query(query, [
    companyId,
    startDate || null,
    endDate || null,
    customerId || null,
    farmerId || null,
    driverId || null,
  ]);

  // ================= GRAND TOTAL SUMMARY =================

  const summary = res.rows.reduce(
    (acc, row) => {
      acc.total_sales += Number(row.total_sales || 0);
      acc.cash_received += Number(row.cash_received || 0);
      acc.upi_received += Number(row.upi_received || 0);
      acc.pending += Number(row.pending_amount || 0);
      acc.total_transactions += Number(row.total_transactions || 0);
      return acc;
    },
    {
      total_sales: 0,
      cash_received: 0,
      upi_received: 0,
      pending: 0,
      total_transactions: 0,
    }
  );

  return {
    filters,
    summary,
    rows: res.rows,
  };
};


exports.getTripReport = async (companyId, filters) => {
  const {
    startDate = null,
    endDate = null,
    farmerId = null,
    driverId = null,
  } = filters || {};

  const result = await pool.query(
    `
    SELECT
      t.id AS trip_id,
      t.trip_date,
      t.total_birds,

      fr.name AS farmer_name,
      u.name AS driver_name,

      COALESCE(SUM(s.total_amount),0) AS total_sales,
      COALESCE(SUM(s.cash_amount),0) AS cash_received,
      COALESCE(SUM(s.upi_amount),0) AS upi_received,

      COALESCE(
        SUM(s.total_amount) -
        SUM(COALESCE(s.cash_amount,0) + COALESCE(s.upi_amount,0)),
        0
      ) AS pending_amount

    FROM trips t

    LEFT JOIN farms fa ON fa.id = t.farm_id
    LEFT JOIN farmers fr ON fr.id = fa.farmer_id
    LEFT JOIN users u ON u.id = t.driver_id
    LEFT JOIN sales s ON s.trip_id = t.id

    WHERE t.company_id = $1

      AND ($2::date IS NULL OR t.trip_date >= $2)
      AND ($3::date IS NULL OR t.trip_date <= $3)

      AND ($4::int IS NULL OR fr.id = $4)
      AND ($5::int IS NULL OR t.driver_id = $5)

    GROUP BY
      t.id,
      t.trip_date,
      t.total_birds,
      fr.name,
      u.name

    ORDER BY t.trip_date DESC
    `,
    [
      companyId,
      startDate,
      endDate,
      farmerId,
      driverId,
    ]
  );

  return result.rows;
};


// =======================================================
// 2️⃣ SINGLE TRIP SALES DETAILS (EXPAND VIEW)
// =======================================================

exports.getTripSalesDetails = async (tripId) => {

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.created_at::date AS sale_date,

      c.name AS customer_name,

      s.cage_number,
      s.sell_type,

      s.bird_count,
      s.weight,
      s.rate,

      s.total_amount,
      s.cash_amount,
      s.upi_amount,

      (
        s.total_amount -
        (COALESCE(s.cash_amount,0) + COALESCE(s.upi_amount,0))
      ) AS pending

    FROM sales s
    JOIN customers c ON c.id = s.customer_id

    WHERE s.trip_id = $1

    ORDER BY s.created_at DESC
    `,
    [tripId]
  );

  return result.rows;
};

// =======================================================
// CUSTOMER SALES DETAILS (LIKE TRIP SALES)
// =======================================================

exports.getCustomerSalesDetails = async (companyId, customerId) => {
  const result = await pool.query(
    `
    SELECT
      s.id,
      s.created_at::date AS sale_date,

      c.name AS customer_name,

      t.id AS trip_id,
      f.name AS farmer_name,
      u.name AS driver_name,

      s.cage_number,
      s.sell_type,
      s.bird_count,
      s.weight,
      s.rate,

      s.total_amount,
      s.payment_mode,
      s.cash_amount,
      s.upi_amount,

      (
        s.total_amount -
        (COALESCE(s.cash_amount,0) + COALESCE(s.upi_amount,0))
      ) AS pending

    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    JOIN trips t ON t.id = s.trip_id
    JOIN farms fm ON fm.id = t.farm_id          -- ✅ NEW
    JOIN farmers f ON f.id = fm.farmer_id      -- ✅ NEW
    JOIN users u ON u.id = t.driver_id

    WHERE t.company_id = $1
      AND s.customer_id = $2

    ORDER BY s.created_at DESC
    `,
    [companyId, customerId]
  );

  return result.rows;
};

