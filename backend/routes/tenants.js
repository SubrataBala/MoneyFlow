const express = require('express');
const { LandOwner, LandRecord, LandPayment, sequelize } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

// Helper for consistent error responses
const sendError = (res, err, message = 'Server Error') => {
  console.error(err);
  res.status(500).json({ message, error: err.message });
};

// --- Land Owners Routes ---

router.get('/owners', async (req, res) => {
  try {
    const where = {};
    // If the user is an owner, only show their own land owners. Admins see all.
    if (req.user.role === 'owner') {
      where.ownerId = req.user.id;
    }
    const owners = await LandOwner.findAll({ where, order: [['name', 'ASC']] });
    res.json(owners);
  } catch (err) {
    sendError(res, err, 'Failed to fetch owners');
  }
});

router.post('/owners', async (req, res) => {
  try {
    const newOwner = await LandOwner.create({ ...req.body, ownerId: req.user.id });
    res.status(201).json(newOwner);
  } catch (err) {
    sendError(res, err, 'Failed to add owner');
  }
});

router.put('/owners/:id', async (req, res) => {
  try {
    const owner = await LandOwner.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    await owner.update(req.body);
    res.json(owner);
  } catch (err) {
    sendError(res, err, 'Failed to update owner');
  }
});

router.delete('/owners/:id', async (req, res) => {
  try {
    const owner = await LandOwner.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    await owner.destroy();
    res.status(204).send();
  } catch (err) {
    sendError(res, err, 'Failed to delete owner');
  }
});

// --- Land Records Routes ---

router.get('/lands', async (req, res) => {
  try {
    let landRecords;
    if (req.user.role === 'admin') {
      // Admins see all land records.
      landRecords = await LandRecord.findAll({ order: [['createdAt', 'DESC']] });
    } else {
      // Owners see only records belonging to their land owners.
      const userLandOwners = await LandOwner.findAll({
        where: { ownerId: req.user.id },
        attributes: ['id']
      });
      const userLandOwnerIds = userLandOwners.map(lo => lo.id);

      landRecords = await LandRecord.findAll({
        where: { landOwnerId: { [Op.in]: userLandOwnerIds } },
        order: [['createdAt', 'DESC']]
      });
    }
    res.json(landRecords);
  } catch (err) {
    sendError(res, err, 'Failed to fetch land records');
  }
});

router.put('/lands/:id', async (req, res) => {
  try {
    const record = await LandRecord.findByPk(req.params.id, { include: 'owner' });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (record.owner.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not own this land record.' });
    }

    const { land_owner_id, land_measurement, converted_units, price_per_unit, total_amount, notes } = req.body;
    await record.update({
      landOwnerId: land_owner_id,
      landMeasurement: land_measurement,
      convertedUnits: converted_units,
      pricePerUnit: price_per_unit,
      totalAmount: total_amount,
      notes
    });
    res.json(record);
  } catch (err) {
    sendError(res, err, 'Failed to update land record');
  }
});

// POST multiple land records for one owner
router.post('/lands/bulk', async (req, res) => {
  const { land_owner_id, lands } = req.body;
  if (!land_owner_id || !Array.isArray(lands) || lands.length === 0) {
    return res.status(400).json({ message: 'Owner ID and a list of lands are required.' });
  }

  const ownerCheck = await LandOwner.findOne({ where: { id: land_owner_id, ownerId: req.user.id } });
  if (!ownerCheck) {
    return res.status(403).json({ message: 'Forbidden: You do not own this land owner record.' });
  }

  const t = await sequelize.transaction();
  try {
    const recordsToCreate = lands.map(land => ({
      landOwnerId: land_owner_id,
      landMeasurement: land.land_measurement,
      convertedUnits: land.converted_units,
      pricePerUnit: land.price_per_unit,
      totalAmount: land.total_amount,
      notes: land.notes,
    }));
    const newRecords = await LandRecord.bulkCreate(recordsToCreate, { transaction: t, validate: true });
    await t.commit();
    res.status(201).json(newRecords);
  } catch (err) {
    await t.rollback();
    sendError(res, err, 'Failed to add land records in bulk');
  }
});

router.delete('/lands/:id', async (req, res) => {
  try {
    const record = await LandRecord.findByPk(req.params.id, { include: { model: LandOwner, as: 'owner' } });
    if (!record) return res.status(404).json({ message: 'Record not found' });
    // Security check: Ensure the land record belongs to the logged-in owner.
    if (record.owner.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this record.' });
    }
    await record.destroy();
    res.status(204).send();
  } catch (err) {
    sendError(res, err, 'Failed to delete land record');
  }
});

// --- Land Payments Routes ---

router.get('/payments', async (req, res) => {
  try {
    let landPayments;
    if (req.user.role === 'admin') {
      // Admins see all payments.
      landPayments = await LandPayment.findAll({ order: [['date', 'DESC'], ['createdAt', 'DESC']] });
    } else {
      // Owners see only payments belonging to their land owners.
      const userLandOwners = await LandOwner.findAll({
        where: { ownerId: req.user.id },
        attributes: ['id']
      });
      const userLandOwnerIds = userLandOwners.map(lo => lo.id);

      landPayments = await LandPayment.findAll({
        where: { landOwnerId: { [Op.in]: userLandOwnerIds } },
        order: [['date', 'DESC'], ['createdAt', 'DESC']]
      });
    }
    res.json(landPayments);
  } catch (err) {
    sendError(res, err, 'Failed to fetch payments');
  }
});

router.post('/payments', async (req, res) => {
  const { land_owner_id, date, amount_paid, payment_method, notes } = req.body;
  try {
    const ownerCheck = await LandOwner.findOne({ where: { id: land_owner_id, ownerId: req.user.id } });
    if (!ownerCheck) {
      return res.status(403).json({ message: 'Forbidden: You do not own this land owner record.' });
    }

    const newPayment = await LandPayment.create({
      landOwnerId: land_owner_id,
      date,
      amountPaid: amount_paid,
      paymentMethod: payment_method,
      notes
    });
    res.status(201).json(newPayment);
  } catch (err) {
    sendError(res, err, 'Failed to add payment');
  }
});

router.put('/payments/:id', async (req, res) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id, { include: 'owner' });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Security check: Allow admin or the record's owner to edit.
    if (req.user.role !== 'admin' && payment.owner.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to edit this payment.' });
    }

    const { land_owner_id, date, amount_paid, payment_method, notes } = req.body;
    await payment.update({
      landOwnerId: land_owner_id,
      date,
      amountPaid: amount_paid,
      paymentMethod: payment_method,
      notes
    });
    res.json(payment);
  } catch (err) {
    sendError(res, err, 'Failed to update payment');
  }
});

router.delete('/payments/:id', async (req, res) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id, { include: { model: LandOwner, as: 'owner' } });
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    // Security check: Ensure the payment belongs to the logged-in owner.
    if (payment.owner.ownerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this payment.' });
    }
    await payment.destroy();
    res.status(204).send();
  } catch (err) {
    sendError(res, err, 'Failed to delete payment');
  }
});

module.exports = router;