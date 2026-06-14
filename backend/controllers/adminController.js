const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sequelize, Admin, Owner, Labour, LandOwner, LandRecord, LandPayment, FertilizerShopkeeper, FertilizerPurchase, FertilizerPurchaseItem, FertilizerPayment, DieselPump, DieselPurchase, DieselPayment, DailyWorkerSummary, DailyWorkerPayment } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

const isOwnerActive = (activeStatus) => (
  activeStatus === true || activeStatus === 'true' || activeStatus === 1 || activeStatus === '1'
);

const ensureManagedOwner = async (ownerId, adminId, transaction) => {
  if (!ownerId) return null;
  return Owner.findOne({ where: { id: ownerId, adminId }, transaction });
};

const applyDailyWorkerPayment = async ({ ownerId, startDate, endDate, amount, transaction }) => {
  const records = await DailyWorkerSummary.findAll({
    where: { ownerId, date: { [Op.between]: [startDate, endDate] } },
    order: [['date', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  if (records.length === 0) {
    const err = new Error('Daily worker records not found for this date range');
    err.statusCode = 404;
    throw err;
  }

  const totalDue = records.reduce((sum, record) => sum + Math.max(parseFloat(record.remaining || 0), 0), 0);
  if (totalDue <= 0) {
    const err = new Error('No remaining payment for this date range');
    err.statusCode = 400;
    throw err;
  }
  if (amount > totalDue) {
    const err = new Error('Payment amount cannot be greater than remaining amount');
    err.statusCode = 400;
    throw err;
  }

  let amountLeft = amount;
  for (const record of records) {
    if (amountLeft <= 0) break;
    const remaining = Math.max(parseFloat(record.remaining || 0), 0);
    if (remaining <= 0) continue;

    const applied = Math.min(remaining, amountLeft);
    const totalPaid = parseFloat(record.totalPaid || 0) + applied;
    record.totalPaid = totalPaid;
    record.remaining = Math.max(parseFloat(record.totalWage || 0) - totalPaid, 0);
    amountLeft -= applied;
    await record.save({ transaction });
  }
};

const reverseDailyWorkerPayment = async ({ ownerId, startDate, endDate, amount, transaction }) => {
  const records = await DailyWorkerSummary.findAll({
    where: { ownerId, date: { [Op.between]: [startDate, endDate] } },
    order: [['date', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE
  });

  let amountLeft = amount;
  for (const record of records) {
    if (amountLeft <= 0) break;
    const paid = Math.max(parseFloat(record.totalPaid || 0), 0);
    if (paid <= 0) continue;

    const reversed = Math.min(paid, amountLeft);
    const totalPaid = Math.max(paid - reversed, 0);
    record.totalPaid = totalPaid;
    record.remaining = Math.max(parseFloat(record.totalWage || 0) - totalPaid, 0);
    amountLeft -= reversed;
    await record.save({ transaction });
  }
};

exports.createOwner = async (req, res, next) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ message: 'All fields required' });

    const existing = await Owner.findOne({ where: { username } });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    // Pass the plain-text password directly to the create method.
    // The Owner model has a `beforeCreate` hook that will automatically and correctly hash the password.
    // Hashing it here would cause it to be double-hashed, preventing logins.
    const owner = await Owner.create({ username, password, name, role: 'owner', activeStatus: true, adminId: req.user.id });
    res.status(201).json({
      message: 'Owner created',
      owner: { id: owner.id, username: owner.username, name: owner.name, activeStatus: owner.activeStatus }
    });
  } catch (err) {
    next(err);
  }
};

exports.getDailySummaryForOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ message: 'ownerId is required' });
    }
    // Security check: Ensure the requested owner belongs to the logged-in admin.
    const owner = await ensureManagedOwner(ownerId, req.user.id);
    if (!owner) {
      return res.status(403).json({ message: 'Access denied. You can only view data for owners you manage.' });
    }
    const [records, payments] = await Promise.all([
      DailyWorkerSummary.findAll({
        where: { ownerId },
        order: [['date', 'DESC']],
      }),
      DailyWorkerPayment.findAll({
        where: { ownerId },
        order: [['paymentDate', 'DESC'], ['id', 'DESC']],
      })
    ]);
    res.json({ records, payments });
  } catch (err) {
    next(err);
  }
};

exports.createDailyWorkerPaymentForOwner = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { ownerId, startDate, endDate, amount, paymentDate, notes, paymentMethod } = req.body;
    const paymentAmount = parseFloat(amount);

    if (!ownerId || !startDate || !endDate || !paymentAmount || paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Owner, date range, and valid payment amount are required' });
    }
    if (startDate > endDate) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const owner = await ensureManagedOwner(ownerId, req.user.id, transaction);
    if (!owner) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Access denied.' });
    }

    await applyDailyWorkerPayment({ ownerId, startDate, endDate, amount: paymentAmount, transaction });
    const payment = await DailyWorkerPayment.create({
      ownerId,
      startDate,
      endDate,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      amount: paymentAmount,
      notes,
      paymentMethod: paymentMethod || 'Cash'
    }, { transaction });

    await transaction.commit();
    res.status(201).json(payment);
  } catch (err) {
    if (transaction) await transaction.rollback();
    res.status(err.statusCode || 500);
    next(err);
  }
};

exports.updateDailyWorkerPayment = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const payment = await DailyWorkerPayment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Payment not found' });
    }

    const owner = await ensureManagedOwner(payment.ownerId, req.user.id, transaction);
    if (!owner) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { startDate, endDate, paymentDate, amount, notes, paymentMethod } = req.body;
    const nextStartDate = startDate || payment.startDate;
    const nextEndDate = endDate || payment.endDate;
    const nextAmount = parseFloat(amount);

    if (!nextStartDate || !nextEndDate || !nextAmount || nextAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Date range and valid payment amount are required' });
    }
    if (nextStartDate > nextEndDate) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    await reverseDailyWorkerPayment({
      ownerId: payment.ownerId,
      startDate: payment.startDate,
      endDate: payment.endDate,
      amount: parseFloat(payment.amount || 0),
      transaction
    });
    await applyDailyWorkerPayment({
      ownerId: payment.ownerId,
      startDate: nextStartDate,
      endDate: nextEndDate,
      amount: nextAmount,
      transaction
    });

    await payment.update({
      startDate: nextStartDate,
      endDate: nextEndDate,
      paymentDate: paymentDate || payment.paymentDate,
      amount: nextAmount,
      notes,
      paymentMethod: paymentMethod || 'Cash'
    }, { transaction });

    await transaction.commit();
    res.json(payment);
  } catch (err) {
    if (transaction) await transaction.rollback();
    res.status(err.statusCode || 500);
    next(err);
  }
};

exports.deleteDailyWorkerPayment = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const payment = await DailyWorkerPayment.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Payment not found' });
    }

    const owner = await ensureManagedOwner(payment.ownerId, req.user.id, transaction);
    if (!owner) {
      await transaction.rollback();
      return res.status(403).json({ message: 'Access denied.' });
    }

    await reverseDailyWorkerPayment({
      ownerId: payment.ownerId,
      startDate: payment.startDate,
      endDate: payment.endDate,
      amount: parseFloat(payment.amount || 0),
      transaction
    });
    await payment.destroy({ transaction });

    await transaction.commit();
    res.status(204).send();
  } catch (err) {
    if (transaction) await transaction.rollback();
    next(err);
  }
};

exports.updateDailySummary = async (req, res, next) => {
  try {
    const record = await DailyWorkerSummary.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Security check: Ensure the record belongs to an owner managed by this admin.
    const owner = await Owner.findOne({ where: { id: record.ownerId, adminId: req.user.id } });
    if (!owner) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const { date, totalWorkers, dailyAmount, totalPaid } = req.body;
    const totalWage = parseFloat(totalWorkers) * parseFloat(dailyAmount);
    const paid = parseFloat(totalPaid) || 0;
    const remaining = totalWage - paid;

    await record.update({ date, totalWorkers, dailyAmount, totalPaid: paid, totalWage, remaining });
    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.deleteDailySummary = async (req, res, next) => {
  try {
    const record = await DailyWorkerSummary.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });

    const owner = await Owner.findOne({ where: { id: record.ownerId, adminId: req.user.id } });
    if (!owner) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const count = await DailyWorkerSummary.destroy({ where: { id: req.params.id } });
    if (count === 0) return res.status(404).json({ message: 'Record not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.createAdmin = async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ message: 'Admin name and Gmail are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail.endsWith('@gmail.com')) {
      return res.status(400).json({ message: 'Admin login is Gmail only. Please use a Gmail address.' });
    }

    // Check for username collision in both Admin and Owner tables
    const existingAdmin = await Admin.findOne({ where: { [Op.or]: [{ username: normalizedEmail }, { email: normalizedEmail }] } });
    const existingOwner = await Owner.findOne({ where: { username: normalizedEmail } });
    if (existingAdmin || existingOwner) {
      return res.status(400).json({ message: 'This Gmail is already registered.' });
    }

    await Admin.create({
      username: normalizedEmail,
      email: normalizedEmail,
      password: crypto.randomBytes(32).toString('hex'),
      name,
    });

    res.status(201).json({ message: 'Admin Gmail added. They can now continue with Gmail.' });
  } catch (err) {
    // Pass errors to the global error handler
    next(err);
  }
};

exports.getDieselDataForOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ message: 'ownerId is required' });
    }

    // Security check
    const owner = await Owner.findOne({ where: { id: ownerId, adminId: req.user.id } });
    if (!owner) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const [pumps, purchases, payments] = await Promise.all([
      DieselPump.findAll({ where: { OwnerId: ownerId }, order: [['createdAt', 'DESC']] }),
      DieselPurchase.findAll({ where: { OwnerId: ownerId }, order: [['date', 'DESC']] }),
      DieselPayment.findAll({ where: { OwnerId: ownerId }, order: [['payment_date', 'DESC']] }),
    ]);

    res.json({ pumps, purchases, payments });
  } catch (err) {
    next(err);
  }
};

exports.deleteDieselPump = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pump = await DieselPump.findByPk(id);
    if (!pump) return res.status(404).json({ message: 'Pump not found' });

    const owner = await Owner.findOne({ where: { id: pump.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const count = await DieselPump.destroy({ where: { id } });
    if (count === 0) return res.status(404).json({ message: 'Pump not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.updateDieselPump = async (req, res, next) => {
  try {
    const pump = await DieselPump.findByPk(req.params.id);
    if (!pump) return res.status(404).json({ message: 'Pump not found' });

    const owner = await Owner.findOne({ where: { id: pump.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const { name, owner_name, contact_number, address } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Pump name is required.' });
    }

    await pump.update({
      name: String(name).trim(),
      owner_name,
      contact_number,
      address
    });
    res.json(pump);
  } catch (err) {
    next(err);
  }
};

exports.deleteDieselPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
    const purchase = await DieselPurchase.findByPk(id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const owner = await Owner.findOne({ where: { id: purchase.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const count = await DieselPurchase.destroy({ where: { id } });
    if (count === 0) return res.status(404).json({ message: 'Purchase not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteDieselPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await DieselPayment.findByPk(id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const owner = await Owner.findOne({ where: { id: payment.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const count = await DieselPayment.destroy({ where: { id } });
    if (count === 0) return res.status(404).json({ message: 'Payment not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.updateDieselPurchase = async (req, res, next) => {
  try {
    const purchase = await DieselPurchase.findByPk(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    const owner = await Owner.findOne({ where: { id: purchase.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    // Admin route, so we update directly without checking ownerId.
    await purchase.update(req.body);
    res.json(purchase);
  } catch (err) {
    next(err);
  }
};

exports.updateDieselPayment = async (req, res, next) => {
  try {
    const payment = await DieselPayment.findByPk(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    const owner = await Owner.findOne({ where: { id: payment.OwnerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    await payment.update(req.body);
    res.json(payment);
  } catch (err) {
    next(err);
  }
};

exports.getFertilizerDataForOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ message: 'ownerId is required' });
    }

    // Security check: Ensure the owner exists and belongs to the current admin.
    const owner = await Owner.findOne({ where: { id: ownerId, adminId: req.user.id } });
    if (!owner) {
      return res.status(403).json({ message: 'Access denied or owner not found.' });
    }

    const [shopkeepers, purchases, payments] = await Promise.all([
      FertilizerShopkeeper.findAll({ where: { ownerId }, order: [['name', 'ASC']] }),
      FertilizerPurchase.findAll({ where: { ownerId }, include: 'items', order: [['date', 'DESC']] }),
      FertilizerPayment.findAll({ where: { ownerId }, order: [['date', 'DESC']] })
    ]);

    res.json({ shopkeepers, purchases, payments });
  } catch (err) {
    next(err);
  }
};

exports.deleteFertilizerShopkeeper = async (req, res, next) => {
  try {
    const shopkeeper = await FertilizerShopkeeper.findByPk(req.params.id);
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });

    const owner = await Owner.findOne({ where: { id: shopkeeper.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    await shopkeeper.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.updateFertilizerShopkeeper = async (req, res, next) => {
  try {
    const shopkeeper = await FertilizerShopkeeper.findByPk(req.params.id);
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });

    const owner = await Owner.findOne({ where: { id: shopkeeper.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const { name, phone, address } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Shopkeeper name is required.' });
    }

    await shopkeeper.update({
      name: String(name).trim(),
      phone,
      address
    });
    res.json(shopkeeper);
  } catch (err) {
    next(err);
  }
};

exports.deleteFertilizerPurchase = async (req, res, next) => {
  try {
    const purchase = await FertilizerPurchase.findByPk(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    const owner = await Owner.findOne({ where: { id: purchase.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    if (purchase.slip_filename) {
      const filePath = path.join(__dirname, '../public/uploads', purchase.slip_filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error('Failed to delete slip image:', unlinkErr);
        }
      }
    }

    await purchase.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteFertilizerPayment = async (req, res, next) => {
  try {
    const payment = await FertilizerPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const owner = await Owner.findOne({ where: { id: payment.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    await payment.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.updateFertilizerPurchase = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const purchase = await FertilizerPurchase.findByPk(req.params.id);
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const owner = await Owner.findOne({ where: { id: purchase.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const { shopkeeper_id, date, notes, total_amount, items } = req.body;

    await purchase.update({
      FertilizerShopkeeperId: shopkeeper_id,
      date,
      notes,
      total_amount,
    }, { transaction: t });

    // Remove old items and add new ones
    await FertilizerPurchaseItem.destroy({ where: { FertilizerPurchaseId: purchase.id }, transaction: t });

    const purchaseItems = JSON.parse(items).map(item => ({
      FertilizerPurchaseId: purchase.id,
      item_name: item.name,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));

    await FertilizerPurchaseItem.bulkCreate(purchaseItems, { transaction: t });

    await t.commit();
    res.json(purchase);
  } catch (err) {
    await t.rollback();
    // Using next(err) to pass to the global error handler
    next(err);
  }
};

exports.updateFertilizerPayment = async (req, res, next) => {
  try {
    const payment = await FertilizerPayment.findByPk(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const owner = await Owner.findOne({ where: { id: payment.ownerId, adminId: req.user.id } });
    if (!owner) return res.status(403).json({ message: 'Access denied.' });

    const { shopkeeper_id, date, amount_paid, notes } = req.body;

    await payment.update({
      FertilizerShopkeeperId: shopkeeper_id,
      date,
      amount_paid,
      notes
    });

    res.json(payment);
  } catch (err) {
    next(err);
  }
};

exports.updateLandRecord = async (req, res, next) => {
  try {
    const record = await LandRecord.findByPk(req.params.id, {
      include: { model: LandOwner, as: 'owner' }
    });
    if (!record) return res.status(404).json({ message: 'Record not found' });

    if (!record.owner) {
      return res.status(404).json({ message: 'Associated land owner not found for this record.' });
    }

    const mainOwner = await Owner.findOne({ where: { id: record.owner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    await record.update(req.body);
    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.updateLandPayment = async (req, res, next) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id, {
      include: { model: LandOwner, as: 'owner' }
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    if (!payment.owner) {
      return res.status(404).json({ message: 'Associated land owner not found for this payment.' });
    }

    const mainOwner = await Owner.findOne({ where: { id: payment.owner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    await payment.update(req.body);
    res.json(payment);
  } catch (err) {
    next(err);
  }
};

exports.deleteLandOwner = async (req, res, next) => {
  try {
    const owner = await LandOwner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ message: 'Land Owner not found' });

    const mainOwner = await Owner.findOne({ where: { id: owner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    await owner.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.updateLandOwner = async (req, res, next) => {
  try {
    const landOwner = await LandOwner.findByPk(req.params.id);
    if (!landOwner) return res.status(404).json({ message: 'Land Owner not found' });

    const mainOwner = await Owner.findOne({ where: { id: landOwner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    const { name, village, phone, notes } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Land owner name is required.' });
    }

    await landOwner.update({
      name: String(name).trim(),
      village,
      phone,
      notes
    });
    res.json(landOwner);
  } catch (err) {
    next(err);
  }
};

exports.getTenantDataForOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ message: 'ownerId is required' });
    }

    const owner = await Owner.findOne({ where: { id: ownerId, adminId: req.user.id } });
    if (!owner) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const landOwners = await LandOwner.findAll({
      where: { ownerId },
      order: [['name', 'ASC']],
    });

    const landOwnerIds = landOwners.map(lo => lo.id);

    if (landOwnerIds.length === 0) {
      return res.json({ owners: [], lands: [], payments: [] });
    }

    const [landRecords, landPayments] = await Promise.all([
      LandRecord.findAll({
        where: { landOwnerId: { [Op.in]: landOwnerIds } },
        order: [['createdAt', 'DESC']],
      }),
      LandPayment.findAll({
        where: { landOwnerId: { [Op.in]: landOwnerIds } },
        order: [['date', 'DESC']],
      })
    ]);

    res.json({ owners: landOwners, lands: landRecords, payments: landPayments });
  } catch (err) {
    next(err);
  }
};

exports.deleteLandRecord = async (req, res, next) => {
  try {
    const record = await LandRecord.findByPk(req.params.id, {
      include: { model: LandOwner, as: 'owner' }
    });
    if (!record) return res.status(404).json({ message: 'Land Record not found' });

    if (!record.owner) {
      // This case is unlikely if foreign keys are set up, but it's a good safeguard.
      return res.status(404).json({ message: 'Associated land owner not found for this record.' });
    }

    const mainOwner = await Owner.findOne({ where: { id: record.owner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    await record.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteLandPayment = async (req, res, next) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id, {
      include: { model: LandOwner, as: 'owner' }
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    if (!payment.owner) {
      return res.status(404).json({ message: 'Associated land owner not found for this payment.' });
    }

    const mainOwner = await Owner.findOne({ where: { id: payment.owner.ownerId, adminId: req.user.id } });
    if (!mainOwner) return res.status(403).json({ message: 'Access denied.' });

    await payment.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getAllOwners = async (req, res, next) => {
  try {
    const owners = await Owner.findAll({
      where: { adminId: req.user.id },
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
    res.json(owners.map(owner => {
      const data = owner.get({ plain: true });
      return { ...data, activeStatus: isOwnerActive(data.activeStatus) };
    }));
  } catch (err) {
    next(err);
  }
};

exports.toggleOwnerStatus = async (req, res, next) => {
  try {
    const owner = await Owner.findOne({ where: { id: req.params.id, adminId: req.user.id } });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    owner.activeStatus = !isOwnerActive(owner.activeStatus);
    await owner.save();
    res.json({ message: `Owner ${owner.activeStatus ? 'activated' : 'deactivated'}`, activeStatus: owner.activeStatus });
  } catch (err) {
    next(err);
  }
};

exports.resetOwnerPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password required' });
    const owner = await Owner.findOne({ where: { id: req.params.id, adminId: req.user.id } });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    // Set the new plain-text password. The model's `beforeUpdate` hook
    // will detect the change and hash it before saving.
    owner.password = password;
    await owner.save(); // This triggers the update hooks.
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};

exports.deleteOwner = async (req, res, next) => {
  try {
    const owner = await Owner.findOne({ where: { id: req.params.id, adminId: req.user.id } });
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    await owner.destroy();
    res.json({ message: 'Owner deleted' });
  } catch (err) {
    next(err);
  }
};
