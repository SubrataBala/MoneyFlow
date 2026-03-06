const express = require('express');
const router = express.Router();
const { authorize } = require('../middleware/auth');
const { DieselPump, DieselPurchase, DieselPayment } = require('../models');

// Helper for consistent error responses
const handleError = (res, err, message = 'An error occurred.', statusCode = 500) => {
  console.error(message, err);
  res.status(statusCode).json({ message: err.message || message });
};

// All other routes in this file are for owners only.
router.use(authorize('owner'));

// GET all data for the logged-in user
// This is the missing route that was causing the 404 error.
router.get('/data', async (req, res) => {
  try {
    const commonWhere = { where: { OwnerId: req.user.id } };
    const [pumps, purchases, payments] = await Promise.all([
      DieselPump.findAll(commonWhere),
      DieselPurchase.findAll(commonWhere),
      DieselPayment.findAll(commonWhere),
    ]);
    res.json({ pumps, purchases, payments });
  } catch (err) {
    handleError(res, err, 'Failed to fetch diesel data.');
  }
});

// --- PETROL PUMPS ---

// POST /pumps - Add a new petrol pump
router.post('/pumps', async (req, res) => {
  try {
    const { name, owner_name, contact_number, address } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Pump name is required.' });
    }
    const newPump = await DieselPump.create({
      name,
      owner_name,
      contact_number,
      address,
      OwnerId: req.user.id,
    });
    res.status(201).json(newPump);
  } catch (err) {
    handleError(res, err, 'Failed to add petrol pump.');
  }
});

// PUT /pumps/:id - Update a petrol pump
router.put('/pumps/:id', async (req, res) => {
  try {
    const { name, owner_name, contact_number, address } = req.body;
    const pump = await DieselPump.findOne({ where: { id: req.params.id, OwnerId: req.user.id } });
    if (!pump) {
      return res.status(404).json({ message: 'Pump not found.' });
    }
    await pump.update({ name, owner_name, contact_number, address });
    res.json(pump);
  } catch (err) {
    handleError(res, err, 'Failed to update petrol pump.');
  }
});

// --- DIESEL PURCHASES ---

// POST /purchases - Add a new purchase
router.post('/purchases', async (req, res) => {
  try {
    const { petrol_pump_id, date, slip_number, amount, notes } = req.body;
    if (!petrol_pump_id || !slip_number || !amount) {
      return res.status(400).json({ message: 'Missing required fields for purchase.' });
    }
    const newPurchase = await DieselPurchase.create({ ...req.body, OwnerId: req.user.id });
    res.status(201).json(newPurchase);
  } catch (err) {
    handleError(res, err, 'Failed to add purchase.');
  }
});

// PUT /purchases/:id - Update a purchase
router.put('/purchases/:id', async (req, res) => {
  try {
    const purchase = await DieselPurchase.findOne({ where: { id: req.params.id, OwnerId: req.user.id } });
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found.' });
    }
    await purchase.update(req.body);
    res.json(purchase);
  } catch (err) {
    handleError(res, err, 'Failed to update purchase.');
  }
});

// DELETE /purchases/:id - Delete a purchase
router.delete('/purchases/:id', async (req, res) => {
  try {
    const count = await DieselPurchase.destroy({ where: { id: req.params.id, OwnerId: req.user.id } });
    if (count === 0) {
      return res.status(404).json({ message: 'Purchase not found.' });
    }
    res.status(204).send();
  } catch (err) {
    handleError(res, err, 'Failed to delete purchase.');
  }
});

// --- DIESEL PAYMENTS ---

// POST /payments - Add a new payment
router.post('/payments', async (req, res) => {
  try {
    const { petrol_pump_id, amount, payment_date } = req.body;
    if (!petrol_pump_id || !amount || !payment_date) {
      return res.status(400).json({ message: 'Missing required fields for payment.' });
    }
    const newPayment = await DieselPayment.create({ ...req.body, OwnerId: req.user.id });
    res.status(201).json(newPayment);
  } catch (err) {
    handleError(res, err, 'Failed to add payment.');
  }
});

// PUT /payments/:id - Update a payment
router.put('/payments/:id', async (req, res) => {
  try {
    const payment = await DieselPayment.findOne({ where: { id: req.params.id, OwnerId: req.user.id } });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found.' });
    }
    await payment.update(req.body);
    res.json(payment);
  } catch (err) {
    handleError(res, err, 'Failed to update payment.');
  }
});

// DELETE /payments/:id - Delete a payment
router.delete('/payments/:id', async (req, res) => {
  try {
    const count = await DieselPayment.destroy({ where: { id: req.params.id, OwnerId: req.user.id } });
    if (count === 0) {
      return res.status(404).json({ message: 'Payment not found.' });
    }
    res.status(204).send();
  } catch (err) {
    handleError(res, err, 'Failed to delete payment.');
  }
});

module.exports = router;