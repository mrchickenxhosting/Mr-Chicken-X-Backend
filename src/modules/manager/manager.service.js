const pool = require('../../config/db');

/* ======================
   CREATE TRIP
   (Manager can create trip)
====================== */
exports.createTrip = async (companyId, { farmerId, driverId }) => {
  if (!farmerId || !driverId) {
    throw new Error('Farmer and Driver are required');
  }

  const res = await pool.query(`
    INSERT INTO orders (
      company_id,
      farmer_id,
      driver_id,
      status,
      total_birds,
      total_weight,
      is_verified
    )
    VALUES ($1,$2,$3,'CREATED',0,0,false)
    RETURNING id
  `, [companyId, farmerId, driverId]);

  return {
    message: 'Trip created successfully',
    tripId: res.rows[0].id
  };
};

/* ======================
   GET ALL TRIPS
   (Show verification status)
====================== */
exports.getTrips = async (companyId) => {
  const res = await pool.query(`
    SELECT
      o.id,
      o.status,
      o.is_verified,
      o.total_birds,
      o.total_weight,
      o.created_at,
      f.name AS farmer_name,
      u.name AS driver_name
    FROM orders o
    JOIN farmers f ON f.id = o.farmer_id
    JOIN users u ON u.id = o.driver_id
    WHERE o.company_id = $1
    ORDER BY o.created_at DESC
  `, [companyId]);

  return res.rows;
};

/* ======================
   GET TRIP SALES
   (Manager verification view)
====================== */
exports.getTripSales = async (companyId, tripId) => {
  console.log({
  tripId,
  companyId,
});
  const res = await pool.query(
    `
    SELECT
      s.id,

      s.sale_target_type,

      s.customer_id,
      c.name AS customer_name,

      s.target_driver_id,
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

      s.created_at

    FROM sales s

LEFT JOIN customers c
  ON c.id = s.customer_id

LEFT JOIN users u
  ON u.id = s.target_driver_id

    JOIN trips t
      ON t.id = s.trip_id

    WHERE s.trip_id = $1
      AND t.company_id = $2

    ORDER BY s.created_at ASC
    `,
    [tripId, companyId]
  );

  return res.rows;
};
/* ======================
   VERIFY TRIP
   (Manager ACTION – mandatory)
====================== */
exports.verifyTrip = async (companyId, tripId) => {
  const res = await pool.query(`
    UPDATE orders
    SET is_verified = true
    WHERE id = $1
      AND company_id = $2
      AND status != 'CLOSED'
    RETURNING id
  `, [tripId, companyId]);

  if (!res.rows.length) {
    throw new Error('Trip not found or already closed');
  }

  return { message: 'Trip verified successfully' };
};

/* ======================
   CLOSE DAY
   (Allowed ONLY after verification)
====================== */
exports.closeDay = async (
  companyId,
  tripId,
  { dieselExpense = 0, otherExpense = 0 }
) => {
  const tripRes = await pool.query(`
    SELECT status, is_verified
    FROM orders
    WHERE id=$1 AND company_id=$2
  `, [tripId, companyId]);

  if (!tripRes.rows.length)
    throw new Error('Trip not found');

  if (tripRes.rows[0].status === 'CLOSED')
    throw new Error('Trip already closed');

  if (!tripRes.rows[0].is_verified)
    throw new Error('Trip must be verified before closing');

  // Save expenses
  await pool.query(`
    INSERT INTO expenses (order_id, diesel_expense, other_expense)
    VALUES ($1,$2,$3)
  `, [tripId, dieselExpense, otherExpense]);

  // Close trip
  await pool.query(`
    UPDATE orders
    SET status='CLOSED'
    WHERE id=$1
  `, [tripId]);

  return { message: 'Day closed successfully' };
};
