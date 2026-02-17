const traderService = require('./trader.service');

/* ========= MANAGERS ========= */
exports.createManager = async (req, res) => {
  try {
    res.status(201).json(
      await traderService.createUser(req.user.companyId, req.body, 'MANAGER')
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getManagers = async (req, res) => {
  try {
    res.json(await traderService.getUsers(req.user.companyId, 'MANAGER'));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateManagerStatus = async (req, res) => {
  try {
    res.json(await traderService.updateUserStatus(
      req.user.companyId, req.params.id, req.body.status, 'MANAGER'
    ));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateManager = async (req, res) => {
  try {
    res.json(
      await traderService.updateUser(
        req.user.companyId,
        req.params.id,
        req.body,
        'MANAGER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteManager = async (req, res) => {
  try {
    res.json(
      await traderService.deleteUser(
        req.user.companyId,
        req.params.id,
        'MANAGER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};


/* ========= DRIVERS ========= */
exports.createDriver = async (req, res) => {
  try {
    res.status(201).json(
      await traderService.createUser(req.user.companyId, req.body, 'DRIVER')
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getDrivers = async (req, res) => {
  try {
    res.json(await traderService.getUsers(req.user.companyId, 'DRIVER'));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateDriverStatus = async (req, res) => {
  try {
    res.json(await traderService.updateUserStatus(
      req.user.companyId, req.params.id, req.body.status, 'DRIVER'
    ));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateDrivers = async (req, res) => {
  try {
    res.json(
      await traderService.updateUser(
        req.user.companyId,
        req.params.id,
        req.body,
        'DRIVER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteDrivers = async (req, res) => {
  try {
    res.json(
      await traderService.deleteUser(
        req.user.companyId,
        req.params.id,
        'DRIVER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

/* ========= LIFTERS ========= */
exports.createLifter = async (req, res) => {
  try {
    res.status(201).json(
      await traderService.createUser(req.user.companyId, req.body, 'LIFTER')
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getLifters = async (req, res) => {
  try {
    res.json(await traderService.getUsers(req.user.companyId, 'LIFTER'));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateLifterStatus = async (req, res) => {
  try {
    res.json(await traderService.updateUserStatus(
      req.user.companyId, req.params.id, req.body.status, 'LIFTER'
    ));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateLifters = async (req, res) => {
  try {
    res.json(
      await traderService.updateUser(
        req.user.companyId,
        req.params.id,
        req.body,
        'LIFTER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteLifters = async (req, res) => {
  try {
    res.json(
      await traderService.deleteUser(
        req.user.companyId,
        req.params.id,
        'LIFTER'
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

/* ========= FARMERS ========= */
exports.createFarmer = async (req, res) => {
  try {
    res.status(201).json(
      await traderService.createFarmer(req.user.companyId, req.body)
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getFarmers = async (req, res) => {
  try {
    res.json(await traderService.getFarmers(req.user.companyId));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateFarmer = async (req, res) => {
  try {
    res.json(
      await traderService.updateFarmer(
        req.user.companyId,
        req.params.id,
        req.body
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.updateFarmLocation = async (req, res) => {
  try {
    const result = await traderService.updateFarmLocation(
      req.user.companyId,
      req.params.id,
      req.body
    );

    res.json(result);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.updateFarmerStatus = async (req, res) => {
  try {
    res.json(
      await traderService.updateFarmerStatus(
        req.user.companyId,
        req.params.id,
        req.body.status
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteFarmer = async (req, res) => {
  try {
    res.json(
      await traderService.deleteFarmer(
        req.user.companyId,
        req.params.id
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};


/* ========= CUSTOMERS ========= */
exports.createCustomer = async (req, res) => {
  try {
    res.status(201).json(
      await traderService.createCustomer(req.user.companyId, req.body)
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getCustomers = async (req, res) => {
  try {
    res.json(await traderService.getCustomers(req.user.companyId));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateCustomer = async (req, res) => {
  try {
    res.json(
      await traderService.updateCustomer(
        req.user.companyId,
        req.params.id,
        req.body
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.updateCustomerStatus = async (req, res) => {
  try {
    res.json(
      await traderService.updateCustomerStatus(
        req.user.companyId,
        req.params.id,
        req.body.status
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    res.json(
      await traderService.deleteCustomer(
        req.user.companyId,
        req.params.id
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};


/* ========= OUTSTANDING ========= */
exports.getCustomerOutstanding = async (req, res) => {
  try {
    res.json(
      await traderService.getCustomerOutstanding(req.user.companyId, req.params.id)
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getAllCustomersOutstanding = async (req, res) => {
  try {
    const data = await traderService.getAllCustomersOutstanding(req.user.companyId);
    res.json(data);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};


/* ========= TRIPS (ORDERS) ========= */
/**
 * orders table = trips
 * This API assigns driver to farmer
 */
exports.createTrip = async (req, res) => {
  console.log(req)
  try {
    const trip = await traderService.createTrip(
      req.user.companyId,
      {
        farm_id: req.body.farm_id,        // ✅ FIXED
        driver_id: req.body.driver_id,
        lifter_id: req.body.lifter_id,
        total_birds: req.body.total_birds,
        trip_time: req.body.trip_time,
        trip_date: req.body.trip_date,
        contact_name: req.body.contact_name,
        contact_phone: req.body.contact_phone,
      }
    );

    res.json(trip);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.getTrips = async (req, res) => {
  try {
    res.json(await traderService.getTrips(req.user.companyId));
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.updateTrip = async (req, res) => {
  try {
    res.json(
      await traderService.updateTrip(
        req.user.companyId,
        req.params.id,
        req.body
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.deleteTrip = async (req, res) => {
  try {
    res.json(
      await traderService.deleteTrip(
        req.user.companyId,
        req.params.id
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

/* ========= SALES (MANAGER VIEW) ========= */
exports.getTripSales = async (req, res) => {
  try {
    res.json(
      await traderService.getTripSales(req.user.companyId, req.params.tripId)
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

/* ========= DAY CLOSE ========= */
exports.closeDay = async (req, res) => {
  try {
    res.json(
      await traderService.closeDay(
        req.user.companyId,
        req.params.tripId,
        req.body
      )
    );
  } catch (e) { res.status(400).json({ message: e.message }); }
};

exports.getTripExpenses = async (req, res) => {
  try {
    res.json(
      await traderService.getTripExpenses(
        req.user.companyId,
        req.params.tripId
      )
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

/* ========= DASHBOARD ========= */
exports.getDashboard = async (req, res) => {
  try {
    res.json(
      await traderService.getDashboard(req.user.companyId)
    );
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.creditCustomer = async (req, res) => {
  try {
    const customerId = req.params.id;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid credit amount' });
    }

    const result = await traderService.creditCustomer(
      req.user.companyId,
      customerId,
      amount
    );

    res.json(result);

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ========= REPORTS ========= */
exports.getReport = async (req, res) => {
  try {

    const {
      startDate,
      endDate,
      customerId,
      farmerId,
      driverId,
      groupBy
    } = req.body;

    const report = await traderService.getSalesReport(
      req.user.companyId,
      {
        startDate,
        endDate,
        customerId,
        farmerId,
        driverId,
        groupBy
      }
    );

    res.json(report);

  } catch (err) {
    console.error(err);
    res.status(400).json({
      message: err.message || 'Failed to load report'
    });
  }
};

exports.getTripReport = async (req, res) => {
  try {

    const companyId = req.user.companyId;
    const filters = req.body;

    const data = await traderService.getTripReport(companyId, filters);

    res.json({
      success: true,
      count: data.length,
      rows: data
    });

  } catch (error) {
    console.error('Trip Report Error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load trip report'
    });
  }
};

// ----------------------------------------
// SINGLE TRIP SALES DETAILS
// ----------------------------------------

exports.getTripSalesDetails = async (req, res) => {
  try {

    const { tripId } = req.params;

    if (!tripId) {
      return res.status(400).json({
        message: 'Trip ID is required'
      });
    }

    const rows = await traderService.getTripSalesDetails(tripId);

    res.json({
      success: true,
      count: rows.length,
      rows
    });

  } catch (error) {
    console.error('Trip Details Error:', error);

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load trip sales'
    });
  }
};

// ----------------------------------------
// CUSTOMER SALES DETAILS (DETAILED)
// ----------------------------------------

exports.getCustomerSalesDetails = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({
        message: 'Customer ID is required',
      });
    }

    const rows = await traderService.getCustomerSalesDetails(
      companyId,
      customerId
    );

    res.json({
      success: true,
      count: rows.length,
      rows,
    });
  } catch (error) {
    console.error('Customer Sales Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load customer sales',
    });
  }
};





