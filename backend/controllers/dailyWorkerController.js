const { sequelize, DailyWorkerSummary, DailyWorkerPayment } = require('../models');
const { Op } = require('sequelize');

exports.createOrUpdate = async (req, res, next) => {
  try {
    const { date, totalWorkers, dailyAmount, totalPaid } = req.body;
    if (!date || !totalWorkers || !dailyAmount) return res.status(400).json({ message: 'Required fields missing' });

    const totalWage = parseFloat(totalWorkers) * parseFloat(dailyAmount);
    const paid = parseFloat(totalPaid) || 0;
    const remaining = totalWage - paid;

    const [record, created] = await DailyWorkerSummary.findOrCreate({
      where: { ownerId: req.user.id, date },
      defaults: { totalWorkers, dailyAmount, totalWage, totalPaid: paid, remaining }
    });

    if (!created) {
      record.totalWorkers = totalWorkers;
      record.dailyAmount = dailyAmount;
      record.totalWage = totalWage;
      record.totalPaid = paid;
      record.remaining = remaining;
      await record.save();
    }

    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.addPayment = async (req, res, next) => {
  let transaction;
  try {
    transaction = await sequelize.transaction();
    const { date, startDate, endDate, amount, notes, paymentMethod } = req.body;
    const rangeStart = startDate || date;
    const rangeEnd = endDate || date;
    const paymentAmount = parseFloat(amount);

    if (!rangeStart || !rangeEnd || !paymentAmount || paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Date range and valid payment amount are required' });
    }

    if (rangeStart > rangeEnd) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Start date cannot be after end date' });
    }

    const records = await DailyWorkerSummary.findAll({
      where: {
        ownerId: req.user.id,
        date: { [Op.between]: [rangeStart, rangeEnd] }
      },
      order: [['date', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (records.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Daily worker records not found for this date range' });
    }

    const totalDue = records.reduce((sum, record) => sum + Math.max(parseFloat(record.remaining || 0), 0), 0);
    if (totalDue <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'No remaining payment for this date range' });
    }
    if (paymentAmount > totalDue) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Payment amount cannot be greater than remaining amount' });
    }

    let amountLeft = paymentAmount;
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

    const payment = await DailyWorkerPayment.create({
      ownerId: req.user.id,
      startDate: rangeStart,
      endDate: rangeEnd,
      paymentDate: date || new Date().toISOString().split('T')[0],
      amount: paymentAmount,
      notes,
      paymentMethod: paymentMethod || 'Cash'
    }, { transaction });

    await transaction.commit();
    res.json(payment);
  } catch (err) {
    if (transaction) await transaction.rollback();
    next(err);
  }
};

exports.getRecords = async (req, res, next) => {
  try {
    const { startDate, endDate, date } = req.query;
    const where = { ownerId: req.user.id };
    if (date) where.date = date;
    else if (startDate && endDate) where.date = { [Op.between]: [startDate, endDate] };
    const records = await DailyWorkerSummary.findAll({ where, order: [['date', 'DESC']] });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const { startDate, endDate, date } = req.query;
    const where = { ownerId: req.user.id };

    if (date) {
      where.paymentDate = date;
    } else if (startDate && endDate) {
      where[Op.and] = [
        { startDate: { [Op.lte]: endDate } },
        { endDate: { [Op.gte]: startDate } }
      ];
    }

    const payments = await DailyWorkerPayment.findAll({ where, order: [['paymentDate', 'DESC'], ['id', 'DESC']] });
    res.json(payments);
  } catch (err) {
    next(err);
  }
};

exports.getTodaySummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const record = await DailyWorkerSummary.findOne({ where: { ownerId: req.user.id, date: today } });
    res.json(record || null);
  } catch (err) {
    next(err);
  }
};
