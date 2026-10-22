const pool = require('../../config/db');

/* ======================
   1️⃣ VIEW ASSIGNED TRIPS
====================== */
exports.getAssignedTrips = async (user) => {
  const res = await pool.query(
    `
    SELECT
      t.id,
      t.company_id,

        t.source_type,
  t.source_driver_id,

  sourceDriver.name AS source_driver_name,
  sourceDriver.mobile AS source_driver_mobile,

      -- Farm Info
      t.farm_id,
      fa.location AS farm_location,
      fa.latitude AS farm_latitude,
      fa.longitude AS farm_longitude,

      -- Farmer Info
      f.id AS farmer_id,
      f.name AS farmer_name,
      f.mobile AS farmer_mobile,

      -- Driver Info
      t.driver_id,

      -- Lifter Info
      t.lifter_id,

      -- Trip Info
      t.total_birds,
      t.trip_time,
      t.trip_date,
      t.approx_rate,
      t.status,
      t.created_at,

      -- Trader / Company Info (FOR QR)
      c.company_name,
      u.upi_id AS trader_upi_id

    FROM trips t

LEFT JOIN farms fa
  ON fa.id = t.farm_id

LEFT JOIN farmers f
  ON f.id = fa.farmer_id

LEFT JOIN users sourceDriver
  ON sourceDriver.id = t.source_driver_id
    JOIN companies c ON c.id = t.company_id
    JOIN users u ON u.id = c.owner_user_id

    WHERE (t.driver_id = $1 OR t.lifter_id = $1)
      AND t.company_id = $2
      AND t.status IN ('CREATED', 'IN_PROGRESS', 'LIFTED')

    ORDER BY t.trip_date DESC, t.trip_time DESC
    `,
    [user.userId, user.companyId]
  );

  return res.rows;
};


/* ======================
   2️⃣ LIFT TRIP
====================== */
exports.addCageEntry = async (user, tripId, cageNumber, data) => {
  const { color = 'DEFAULT', bird_count, weight } = data;

  if (!bird_count || !weight) {
    throw new Error('Bird count and weight required');
  }

  // 1️⃣ Validate trip
  const tripRes = await pool.query(
    `SELECT * FROM trips WHERE id = $1`,
    [tripId]
  );

  if (!tripRes.rows.length) {
    throw new Error('Trip not found');
  }

  const trip = tripRes.rows[0];

  // 2️⃣ Authorization (Driver OR Lifter)
  if (
    trip.driver_id !== user.userId &&
    trip.lifter_id !== user.userId
  ) {
    throw new Error('Not authorized for this trip');
  }

  // ❌ Only CLOSED trips are locked
  if (trip.status === 'CLOSED') {
    throw new Error('Trip already closed');
  }

  // 3️⃣ Ensure trip_cage exists
  const cageRes = await pool.query(
    `
    INSERT INTO trip_cages (trip_id, cage_number)
    VALUES ($1, $2)
    ON CONFLICT (trip_id, cage_number)
    DO UPDATE SET cage_number = EXCLUDED.cage_number
    RETURNING id
    `,
    [tripId, cageNumber]
  );

  const tripCageId = cageRes.rows[0].id;

  // 4️⃣ Insert / Update cage entry
  await pool.query(
    `
    INSERT INTO trip_cage_entries
      (trip_cage_id, color, bird_count, weight)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (trip_cage_id, color)
    DO UPDATE SET
      bird_count = EXCLUDED.bird_count,
      weight = EXCLUDED.weight
    `,
    [
      tripCageId,
      color,
      Number(bird_count),
      Number(weight),
    ]
  );

  // 5️⃣ 🔥 ALWAYS RECALCULATE TOTALS
  const totalsRes = await pool.query(
    `
    SELECT
      SUM(e.bird_count) AS total_birds,
      SUM(e.weight) AS total_weight
    FROM trip_cages c
    JOIN trip_cage_entries e ON e.trip_cage_id = c.id
    WHERE c.trip_id = $1
    `,
    [tripId]
  );

  const totalBirds = Number(totalsRes.rows[0].total_birds || 0);
  const totalWeight = Number(totalsRes.rows[0].total_weight || 0);

  await pool.query(
    `
    UPDATE trips
    SET
      total_birds = $1,
      total_weight = $2
    WHERE id = $3
    `,
    [totalBirds, totalWeight, tripId]
  );

  // 6️⃣ Move to IN_PROGRESS if first entry
  if (trip.status === 'CREATED') {
    await pool.query(
      `UPDATE trips SET status = 'IN_PROGRESS' WHERE id = $1`,
      [tripId]
    );
  }

  return {
    message: 'Cage entry saved',
    totalBirds,
    totalWeight,
  };
};


exports.resetCage = async (user, tripId, cageNumber) => {
  const cageRes = await pool.query(
    `
    SELECT tc.id
    FROM trip_cages tc
    JOIN trips t ON t.id = tc.trip_id
    WHERE tc.trip_id=$1
      AND tc.cage_number=$2
AND (t.driver_id=$3 OR t.lifter_id=$3)
    `,
    [tripId, cageNumber, user.userId]
  );

  if (!cageRes.rows.length)
    throw new Error('Cage not found');

  const tripCageId = cageRes.rows[0].id;

  await pool.query(
    `DELETE FROM trip_cage_entries WHERE trip_cage_id=$1`,
    [tripCageId]
  );

  return { message: 'Cage reset successfully' };
};

exports.completeTrip = async (user, tripId) => {
  const totalsRes = await pool.query(
    `
    SELECT
      SUM(bird_count) AS total_birds,
      SUM(weight) AS total_weight
    FROM trip_cage_entries e
    JOIN trip_cages c ON c.id = e.trip_cage_id
    JOIN trips t ON t.id = c.trip_id
    WHERE t.id=$1 AND (t.driver_id=$2 OR t.lifter_id=$2)
    `,
    [tripId, user.userId]
  );

  const totals = totalsRes.rows[0];

  await pool.query(
    `
    UPDATE trips
    SET
      total_birds=$1,
      total_weight=$2,
      status='LIFTED'
    WHERE id=$3
    `,
    [totals.total_birds || 0, totals.total_weight || 0, tripId]
  );

  return {
    message: 'Trip lifted successfully',
    totalBirds: totals.total_birds,
    totalWeight: totals.total_weight,
  };
};

exports.getTripCages = async (user, tripId) => {
  const tripRes = await pool.query(
    `SELECT id FROM trips 
     WHERE id = $1
     AND (driver_id = $2 OR lifter_id = $2)`,
    [tripId, user.userId]
  );

  if (!tripRes.rows.length) {
    throw new Error('Trip not found or not authorized');
  }

  const res = await pool.query(
    `
    SELECT
      tc.cage_number,
      tce.color,
      tce.bird_count,
      tce.weight
    FROM trip_cages tc
    JOIN trip_cage_entries tce ON tce.trip_cage_id = tc.id
    WHERE tc.trip_id = $1
    ORDER BY tc.cage_number
    `,
    [tripId]
  );

  const cageData = {};

  for (const row of res.rows) {
    const cageNo = row.cage_number;
    const color = row.color || 'DEFAULT';

    if (!cageData[cageNo]) cageData[cageNo] = {};

    cageData[cageNo][color] = [
      {
        chickens: Number(row.bird_count || 0),
        weight: Number(row.weight || 0),
        original_chickens: null,
        original_weight: null,
      },
    ];
  }

  return cageData;
};


/* ======================
   3️⃣ SELL TO CUSTOMER
====================== */
// exports.sellToCustomer = async (user, tripId, data) => {
//   const client = await pool.connect();

//   try {
//     await client.query('BEGIN');

//     const {
//       customer_id,
//       cage_numbers,
//       sell_type,
//       bird_count,
//       weight,
//       rate,
//       total_amount,
//       payment_mode,
//       cash_amount = 0,
//       upi_amount = 0,
//     } = data;

//     const isPaymentOnly =
//   Number(total_amount) > 0 &&
//   Number(bird_count) === 0 &&
//   Number(weight) === 0 &&
//   (!sell_type || cage_numbers?.length === 0);

//     // ✅ VALIDATION
// if (
//   !customer_id ||
//   !payment_mode ||
//   (!isPaymentOnly &&
//     (
//       !Array.isArray(cage_numbers) ||
//       cage_numbers.length === 0 ||
//       !sell_type ||
//       !rate
//     ))
// ) {
//   throw new Error('Incomplete sale data');
// }

//     // ✅ CHECK TRIP
//     const tripRes = await client.query(
//       `
//       SELECT *
//       FROM trips
//       WHERE id = $1
//         AND driver_id = $2
//         AND status = 'LIFTED'
//       FOR UPDATE
//       `,
//       [tripId, user.userId]
//     );

//     if (!tripRes.rows.length) {
//       throw new Error('Trip not ready for selling');
//     }

//     // 🔥 FETCH SELECTED CAGES WITH LOCK
//     const cageData = [];

//     for (const cageNumber of cage_numbers) {
//       const cageRes = await client.query(
//         `
//         SELECT c.id AS trip_cage_id,
//               c.cage_number,
//               e.id AS entry_id,
//               e.bird_count,
//               e.weight
//         FROM trip_cages c
//         JOIN trip_cage_entries e ON e.trip_cage_id = c.id
//         WHERE c.trip_id = $1
//           AND c.cage_number = $2
//         FOR UPDATE
//         `,
//         [tripId, cageNumber]
//       );

//       if (!cageRes.rows.length) {
//         throw new Error(`Cage ${cageNumber} not found`);
//       }

//       cageData.push(...cageRes.rows);
//     }

//     // 🔥 TOTAL AVAILABLE CHECK
//     const totalAvailableBirds = cageData.reduce(
//       (sum, row) => sum + Number(row.bird_count || 0),
//       0
//     );

//     if (sell_type === 'CUSTOM' && bird_count > totalAvailableBirds) {
//       throw new Error('Not enough birds available');
//     }

//     let birdsRemaining = Number(bird_count || 0);

//     // 🔥 Calculate avg weight per bird (CUSTOM only)
//     const avgWeightPerBird =
//       sell_type === 'CUSTOM'
//         ? Number(weight) / Number(bird_count)
//         : 0;

//     // 🔥 PROCESS CAGES
//     for (const row of cageData) {
//       let birdsToSell = 0;
//       let weightToSell = 0;

//       if (sell_type === 'FULL') {
//         birdsToSell = Number(row.bird_count);
//         weightToSell = Number(row.weight);
//       } else {
//         if (birdsRemaining <= 0) break;

//         birdsToSell = Math.min(row.bird_count, birdsRemaining);

//         weightToSell = Number(
//           (birdsToSell * avgWeightPerBird).toFixed(2)
//         );

//         birdsRemaining -= birdsToSell;
//       }

//       if (birdsToSell <= 0) continue;

//       const amountToSell = Number(
//         (weightToSell * Number(rate)).toFixed(2)
//       );

//       // 🔥 Proportional payment split
//       const proportionalCash =
//         total_amount > 0
//           ? (amountToSell / total_amount) * cash_amount
//           : 0;

//       const proportionalUpi =
//         total_amount > 0
//           ? (amountToSell / total_amount) * upi_amount
//           : 0;

//       // ✅ INSERT SALE
//       await client.query(
//         `
//         INSERT INTO sales (
//           trip_id,
//           customer_id,
//           cage_number,
//           sell_type,
//           bird_count,
//           weight,
//           rate,
//           total_amount,
//           payment_mode,
//           cash_amount,
//           upi_amount
//         )
//         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//         `,
//         [
//           tripId,
//           customer_id,
//           row.cage_number,
//           sell_type,
//           birdsToSell,
//           weightToSell,
//           rate,
//           amountToSell,
//           payment_mode,
//           Number(proportionalCash.toFixed(2)),
//           Number(proportionalUpi.toFixed(2)),
//         ]
//       );

//       // ✅ DEDUCT STOCK
//       await client.query(
//         `
//         UPDATE trip_cage_entries
//         SET bird_count = bird_count - $1,
//             weight = weight - $2
//         WHERE id = $3
//         `,
//         [birdsToSell, weightToSell, row.entry_id]
//       );
//     }

//     // ✅ UPDATE CUSTOMER OUTSTANDING
//     const pendingAmount =
//       Number(total_amount) -
//       (Number(cash_amount) + Number(upi_amount));

//     if (pendingAmount > 0) {
//       await client.query(
//         `
//         UPDATE customers
//         SET outstanding = outstanding + $1
//         WHERE id = $2
//         `,
//         [pendingAmount, customer_id]
//       );
//     }

//     await client.query('COMMIT');

//     return { message: 'Sale recorded successfully' };

//   } catch (error) {
//     await client.query('ROLLBACK');
//     throw error;
//   } finally {
//     client.release();
//   }
// };


exports.sellToCustomer = async (user, tripId, data) => {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const {
      customer_id,
      target_driver_id,
      sale_target_type,
      cage_numbers,
      sell_type,
      bird_count,
      weight,
      rate,
      total_amount,
      payment_mode,
      cash_amount = 0,
      upi_amount = 0,
    } = data;

    // =========================================================
    // 1. NORMALIZE AND VALIDATE INPUT
    // =========================================================

    const targetType = String(sale_target_type || '').toUpperCase();
    const saleType = String(sell_type || '').toUpperCase();
    const paymentMode = String(payment_mode || '').toUpperCase();

    const isCustomerSale = targetType === 'CUSTOMER';
    const isDriverTransfer = targetType === 'DRIVER';

    const cash = Number(cash_amount);
    const upi = Number(upi_amount);
    const requestedBirds = Number(bird_count || 0);
    const requestedWeight = Number(weight || 0);
    const saleRate = Number(rate || 0);
    const suppliedTotal = Number(total_amount || 0);

    if (!isCustomerSale && !isDriverTransfer) {
      throw new Error('Invalid sale target type');
    }

    if (!paymentMode) {
      throw new Error('Payment mode is required');
    }

    if (
      !Number.isFinite(cash) ||
      !Number.isFinite(upi) ||
      cash < 0 ||
      upi < 0
    ) {
      throw new Error('Cash and UPI amounts must be valid non-negative numbers');
    }

    if (
      !Number.isFinite(requestedBirds) ||
      !Number.isFinite(requestedWeight) ||
      !Number.isFinite(saleRate) ||
      !Number.isFinite(suppliedTotal) ||
      requestedBirds < 0 ||
      requestedWeight < 0 ||
      saleRate < 0 ||
      suppliedTotal < 0
    ) {
      throw new Error('Invalid sale amount, bird count, weight, or rate');
    }

    if (isCustomerSale && !customer_id) {
      throw new Error('Customer is required');
    }

    if (isDriverTransfer && !target_driver_id) {
      throw new Error('Target driver is required');
    }

    if (
      isDriverTransfer &&
      Number(target_driver_id) === Number(user.userId)
    ) {
      throw new Error('Cannot transfer to yourself');
    }

    const selectedCages = Array.isArray(cage_numbers)
      ? [...new Set(cage_numbers.map(String))]
      : [];

    const isPaymentOnly =
      suppliedTotal > 0 &&
      requestedBirds === 0 &&
      requestedWeight === 0 &&
      !sell_type &&
      selectedCages.length === 0;

    if (!isPaymentOnly) {
      if (selectedCages.length === 0) {
        throw new Error('Select at least one cage');
      }

      if (!['FULL', 'CUSTOM'].includes(saleType)) {
        throw new Error('Sell type must be FULL or CUSTOM');
      }

      if (saleRate <= 0) {
        throw new Error('Rate must be greater than zero');
      }

      if (saleType === 'CUSTOM') {
        if (requestedBirds <= 0 || requestedWeight <= 0) {
          throw new Error(
            'Custom sale requires a positive bird count and weight'
          );
        }
      }
    }

    // =========================================================
    // 2. LOCK AND VALIDATE TRIP
    // =========================================================

    const tripRes = await client.query(
      `
      SELECT *
      FROM trips
      WHERE id = $1
        AND driver_id = $2
        AND status = 'LIFTED'
      FOR UPDATE
      `,
      [tripId, user.userId]
    );

    if (!tripRes.rows.length) {
      throw new Error('Trip not ready for selling');
    }

    const trip = tripRes.rows[0];

    // =========================================================
    // 3. LOCK CUSTOMER AND READ CREDIT SETTINGS
    // =========================================================

    let customer = null;
    let customerType = null;
    let customerOutstanding = 0;
    let customerCreditLimit = 0;
    let creditWarning = null;

    if (isCustomerSale) {
      const customerRes = await client.query(
        `
        SELECT
          id,
          company_id,
          name,
          customer_type,
          credit_limit,
          outstanding
        FROM customers
        WHERE id = $1
          AND company_id = $2
        FOR UPDATE
        `,
        [customer_id, trip.company_id]
      );

      if (!customerRes.rows.length) {
        throw new Error('Customer not found for this company');
      }

      customer = customerRes.rows[0];

      customerType = String(
        customer.customer_type || 'GREEN'
      ).toUpperCase();

      if (!['GREEN', 'ORANGE', 'RED'].includes(customerType)) {
        throw new Error('Invalid customer credit type');
      }

      customerOutstanding = Number(customer.outstanding || 0);
      customerCreditLimit = Number(customer.credit_limit || 0);

      if (
        !Number.isFinite(customerOutstanding) ||
        customerOutstanding < 0 ||
        !Number.isFinite(customerCreditLimit) ||
        customerCreditLimit < 0
      ) {
        throw new Error('Invalid customer credit settings');
      }
    }

    // =========================================================
    // 4. PAYMENT-ONLY FLOW
    // =========================================================

    if (isPaymentOnly) {
      if (!isCustomerSale) {
        throw new Error('Payment-only entries are supported for customers only');
      }

      const paymentAmount = Number((cash + upi).toFixed(2));

      if (paymentAmount <= 0) {
        throw new Error('Payment amount must be greater than zero');
      }

      if (paymentAmount > customerOutstanding) {
        throw new Error(
          `Payment exceeds the outstanding balance of ${customerOutstanding.toFixed(2)}`
        );
      }

      await client.query(
        `
        INSERT INTO sales (
          trip_id,
          customer_id,
          target_driver_id,
          sale_target_type,
          cage_number,
          sell_type,
          bird_count,
          weight,
          rate,
          total_amount,
          payment_mode,
          cash_amount,
          upi_amount
        )
        VALUES ($1, $2, NULL, 'CUSTOMER', 0, 'PAYMENT',
                0, 0, 0, $3, $4, $5, $6)
        `,
        [
          tripId,
          customer_id,
          paymentAmount,
          paymentMode,
          cash,
          upi,
        ]
      );

      const updatedOutstanding = Number(
        Math.max(0, customerOutstanding - paymentAmount).toFixed(2)
      );

      await client.query(
        `
        UPDATE customers
        SET outstanding = $1
        WHERE id = $2
          AND company_id = $3
        `,
        [updatedOutstanding, customer_id, trip.company_id]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      return {
        message: 'Payment recorded successfully',
        payment_amount: paymentAmount,
        outstanding: updatedOutstanding,
      };
    }

    // =========================================================
    // 5. FETCH SELECTED CAGES AND LOCK INVENTORY ROWS
    // =========================================================

    const cageData = [];

    for (const cageNumber of selectedCages) {
      const cageRes = await client.query(
        `
        SELECT
          c.id AS trip_cage_id,
          c.cage_number,
          e.id AS entry_id,
          e.bird_count,
          e.weight
        FROM trip_cages c
        JOIN trip_cage_entries e
          ON e.trip_cage_id = c.id
        WHERE c.trip_id = $1
          AND c.cage_number = $2
        ORDER BY e.id
        FOR UPDATE OF c, e
        `,
        [tripId, cageNumber]
      );

      if (!cageRes.rows.length) {
        throw new Error(`Cage ${cageNumber} not found`);
      }

      cageData.push(...cageRes.rows);
    }

    // =========================================================
    // 6. VALIDATE INVENTORY AND BUILD SALE BREAKDOWN
    // =========================================================

    const totalAvailableBirds = cageData.reduce(
      (sum, row) => sum + Number(row.bird_count || 0),
      0
    );

    const totalAvailableWeight = cageData.reduce(
      (sum, row) => sum + Number(row.weight || 0),
      0
    );

    if (
      cageData.some(
        (row) =>
          !Number.isFinite(Number(row.bird_count)) ||
          !Number.isFinite(Number(row.weight)) ||
          Number(row.bird_count) < 0 ||
          Number(row.weight) < 0
      )
    ) {
      throw new Error('Invalid cage inventory detected');
    }

    if (saleType === 'CUSTOM' && requestedBirds > totalAvailableBirds) {
      throw new Error('Not enough birds available');
    }

    if (saleType === 'CUSTOM' && requestedWeight > totalAvailableWeight) {
      throw new Error('Not enough weight available in the selected cages');
    }

    const avgWeightPerBird =
      saleType === 'CUSTOM'
        ? requestedWeight / requestedBirds
        : 0;

    let birdsRemaining = requestedBirds;
    let weightRemaining = requestedWeight;
    let actualSaleAmount = 0;

    const plannedSales = [];

    for (const row of cageData) {
      let birdsToSell = 0;
      let weightToSell = 0;

      if (saleType === 'FULL') {
        birdsToSell = Number(row.bird_count);
        weightToSell = Number(row.weight);
      } else {
        if (birdsRemaining <= 0) break;

        birdsToSell = Math.min(
          Number(row.bird_count),
          birdsRemaining
        );

        if (birdsToSell <= 0) continue;

        // Keep the final selected portion aligned with the requested
        // weight despite rounding on earlier cage allocations.
        if (birdsToSell === birdsRemaining) {
          weightToSell = Number(weightRemaining.toFixed(2));
        } else {
          weightToSell = Number(
            (birdsToSell * avgWeightPerBird).toFixed(2)
          );
        }

        weightToSell = Math.min(
          weightToSell,
          Number(row.weight),
          weightRemaining
        );

        birdsRemaining -= birdsToSell;
        weightRemaining = Number(
          (weightRemaining - weightToSell).toFixed(2)
        );
      }

      if (birdsToSell <= 0) continue;

      if (
        weightToSell < 0 ||
        weightToSell > Number(row.weight) + 0.001
      ) {
        throw new Error(`Invalid weight allocation for cage ${row.cage_number}`);
      }

      const amountToSell = Number(
        (weightToSell * saleRate).toFixed(2)
      );

      actualSaleAmount = Number(
        (actualSaleAmount + amountToSell).toFixed(2)
      );

      plannedSales.push({
        row,
        birdsToSell,
        weightToSell,
        amountToSell,
      });
    }

    if (!plannedSales.length || actualSaleAmount <= 0) {
      throw new Error('Sale amount must be greater than zero');
    }

    if (saleType === 'CUSTOM' && birdsRemaining > 0) {
      throw new Error('Could not allocate all requested birds');
    }

    if (
      saleType === 'CUSTOM' &&
      Math.abs(weightRemaining) > 0.02
    ) {
      throw new Error('Could not allocate the requested weight');
    }

    // =========================================================
    // 7. VALIDATE PAYMENT AGAINST THE SERVER-CALCULATED SALE
    // =========================================================

    const paymentReceived = Number((cash + upi).toFixed(2));

    if (paymentReceived > actualSaleAmount + 0.001) {
      throw new Error(
        'Payment cannot exceed the calculated sale amount'
      );
    }

    const newOutstanding = isCustomerSale
      ? Number(
          Math.max(
            0,
            customerOutstanding + actualSaleAmount - paymentReceived
          ).toFixed(2)
        )
      : null;

    // =========================================================
// 7. ENFORCE CUSTOMER CREDIT RULES
// =========================================================

// RED: The full amount of the current sale must be paid.
if (
  isCustomerSale &&
  customerType === 'RED' &&
  paymentReceived + 0.001 < actualSaleAmount
) {
  throw new Error(
    'RED customer: full payment is required before completing the sale'
  );
}

// ORANGE:
// - credit_limit = 0: no credit allowed; full current sale must be paid.
// - credit_limit > 0: outstanding after this sale cannot exceed the limit.
if (isCustomerSale && customerType === 'ORANGE') {
  if (
    customerCreditLimit === 0 &&
    paymentReceived + 0.001 < actualSaleAmount
  ) {
    throw new Error(
      'ORANGE customer: full payment is required because the credit limit is zero'
    );
  }

  if (
    customerCreditLimit > 0 &&
    newOutstanding > customerCreditLimit
  ) {
    throw new Error(
      `Credit limit exceeded. Current outstanding: ${customerOutstanding.toFixed(2)}, ` +
      `new outstanding: ${newOutstanding.toFixed(2)}, ` +
      `credit limit: ${customerCreditLimit.toFixed(2)}`
    );
  }
}

// GREEN: Allow the sale even when outstanding exceeds a positive limit,
// but return a warning to the frontend.
if (
  isCustomerSale &&
  customerType === 'GREEN' &&
  customerCreditLimit > 0 &&
  newOutstanding > customerCreditLimit
) {
  creditWarning =
    `Warning: This GREEN customer's outstanding balance will exceed ` +
    `the credit limit of ₹${customerCreditLimit.toFixed(2)}. ` +
    `New outstanding: ₹${newOutstanding.toFixed(2)}. The sale was allowed.`;
}

    // =========================================================
    // 8. ALLOCATE CASH AND UPI PROPORTIONALLY ACROSS CAGE SALES
    // =========================================================

    let allocatedCash = 0;
    let allocatedUpi = 0;

    for (let i = 0; i < plannedSales.length; i += 1) {
      const sale = plannedSales[i];
      const isLast = i === plannedSales.length - 1;

      let saleCash = 0;
      let saleUpi = 0;

      if (isLast) {
        // Put rounding remainders on the final row so totals reconcile.
        saleCash = Number((cash - allocatedCash).toFixed(2));
        saleUpi = Number((upi - allocatedUpi).toFixed(2));
      } else {
        const proportion = sale.amountToSell / actualSaleAmount;

        saleCash = Number((cash * proportion).toFixed(2));
        saleUpi = Number((upi * proportion).toFixed(2));

        allocatedCash = Number((allocatedCash + saleCash).toFixed(2));
        allocatedUpi = Number((allocatedUpi + saleUpi).toFixed(2));
      }

      sale.cashAmount = saleCash;
      sale.upiAmount = saleUpi;
    }

    // =========================================================
    // 9. INSERT SALES AND DEDUCT STOCK
    // =========================================================

    for (const sale of plannedSales) {
      const { row, birdsToSell, weightToSell, amountToSell } = sale;

      await client.query(
        `
        INSERT INTO sales (
          trip_id,
          customer_id,
          target_driver_id,
          sale_target_type,
          cage_number,
          sell_type,
          bird_count,
          weight,
          rate,
          total_amount,
          payment_mode,
          cash_amount,
          upi_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          tripId,
          isCustomerSale ? customer_id : null,
          isDriverTransfer ? target_driver_id : null,
          targetType,
          row.cage_number,
          saleType,
          birdsToSell,
          weightToSell,
          saleRate,
          amountToSell,
          paymentMode,
          sale.cashAmount,
          sale.upiAmount,
        ]
      );

      const stockUpdate = await client.query(
        `
        UPDATE trip_cage_entries
        SET
          bird_count = bird_count - $1,
          weight = GREATEST(0, weight - $2)
        WHERE id = $3
          AND bird_count >= $1
          AND weight >= $2
        `,
        [birdsToSell, weightToSell, row.entry_id]
      );

      if (stockUpdate.rowCount !== 1) {
        throw new Error(
          `Inventory changed while processing cage ${row.cage_number}. Please retry.`
        );
      }
    }

    // =========================================================
    // 10. UPDATE CUSTOMER OUTSTANDING
    // =========================================================

    if (isCustomerSale) {
      await client.query(
        `
        UPDATE customers
        SET outstanding = $1
        WHERE id = $2
          AND company_id = $3
        `,
        [newOutstanding, customer_id, trip.company_id]
      );
    }

    // =========================================================
    // 11. COMMIT
    // =========================================================

    await client.query('COMMIT');
    transactionStarted = false;

    return {
      message: isDriverTransfer
        ? 'Driver transfer recorded successfully'
        : 'Sale recorded successfully',
      sale_amount: actualSaleAmount,
      payment_received: paymentReceived,
      outstanding: isCustomerSale ? newOutstanding : undefined,
      credit_warning: creditWarning,
    };
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Transaction rollback failed:', rollbackError);
      }
    }

    throw error;
  } finally {
    client.release();
  }
};