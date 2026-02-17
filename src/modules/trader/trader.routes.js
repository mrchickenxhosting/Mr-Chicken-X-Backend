const express = require('express');
const router = express.Router();

const authMiddleware = require('../../middlewares/auth.middleware');
const traderController = require('./trader.controller');

/* ================= MANAGERS ================= */
router.get('/managers', authMiddleware, traderController.getManagers);
router.post('/managers', authMiddleware, traderController.createManager);
router.patch('/managers/:id',authMiddleware,traderController.updateManager);
router.patch('/managers/:id/status', authMiddleware, traderController.updateManagerStatus);
router.delete('/managers/:id',authMiddleware,traderController.deleteManager);

/* ================= DRIVERS ================= */
router.post('/drivers', authMiddleware, traderController.createDriver);
router.get('/drivers', authMiddleware, traderController.getDrivers);
router.patch('/drivers/:id',authMiddleware,traderController.updateDrivers);
router.patch('/drivers/:id/status', authMiddleware, traderController.updateDriverStatus);
router.delete('/drivers/:id',authMiddleware,traderController.deleteDrivers);

/* ================= LIFTER ================= */
router.post('/lifters', authMiddleware, traderController.createLifter);
router.get('/lifters', authMiddleware, traderController.getLifters);
router.patch('/lifters/:id',authMiddleware,traderController.updateLifters);
router.patch('/lifters/:id/status', authMiddleware, traderController.updateLifterStatus);
router.delete('/lifters/:id',authMiddleware,traderController.deleteLifters);

/* ================= FARMERS ================= */
router.post('/farmers', authMiddleware, traderController.createFarmer);
router.get('/farmers', authMiddleware, traderController.getFarmers);
router.patch('/farmers/:id',authMiddleware,traderController.updateFarmer);
router.patch('/farmers/:id/status',authMiddleware,traderController.updateFarmerStatus);
router.delete('/farmers/:id',authMiddleware,traderController.deleteFarmer);
router.patch('/farms/:id/location', authMiddleware, traderController.updateFarmLocation);

/* ================= CUSTOMERS ================= */

router.post('/customers', authMiddleware, traderController.createCustomer);
router.get('/customers', authMiddleware, traderController.getCustomers);
router.patch('/customers/:id',authMiddleware,traderController.updateCustomer);
router.patch('/customers/:id/status',authMiddleware,traderController.updateCustomerStatus);
router.delete('/customers/:id',authMiddleware,traderController.deleteCustomer);

// ⚠️ Outstanding will later be calculated from SALES table
router.get('/customers/:id/outstanding', authMiddleware, traderController.getCustomerOutstanding);
router.get('/customers/outstanding', authMiddleware, traderController.getAllCustomersOutstanding);
router.post(
  '/customers/:id/credit',
  authMiddleware,
  traderController.creditCustomer
);


/* ================= TRIPS (ORDERS) ================= */
/**
 * NOTE:
 * orders = trips
 * This API assigns a driver to a farmer for pickup
 */
router.post('/trips', authMiddleware, traderController.createTrip);   // assign trip
router.get('/trips', authMiddleware, traderController.getTrips);      // list trips
router.patch('/trips/:id',authMiddleware,traderController.updateTrip);
router.delete('/trips/:id',authMiddleware,traderController.deleteTrip);

/* ================= SALES (MANAGER VIEW) ================= */
// View all sales for a trip (for verification)
router.get('/trips/:tripId/sales', authMiddleware, traderController.getTripSales);

/* ================= DAY CLOSE ================= */
// Manager verifies cash & closes the day
router.post('/trips/:tripId/close-day', authMiddleware, traderController.closeDay);
router.get(
  '/trips/:tripId/expenses',
  authMiddleware,
  traderController.getTripExpenses
);

/* ================= DASHBOARD ================= */
router.get('/dashboard',authMiddleware,traderController.getDashboard);

/* ================ REPORTS ================= */
router.post(
  '/reports',
  authMiddleware,
  traderController.getReport
);

router.post(
  '/reports/trips',
  authMiddleware,
  traderController.getTripReport
);

router.get(
  '/reports/trips/:tripId',
  authMiddleware,
  traderController.getTripSalesDetails
);

router.get(
  '/reports/customers/:customerId/sales',
  authMiddleware,
  traderController.getCustomerSalesDetails
);


module.exports = router;
