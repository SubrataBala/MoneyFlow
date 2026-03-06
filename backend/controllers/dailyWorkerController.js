const { DailyWorkerSummary } = require('../models');
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

exports.getTodaySummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const record = await DailyWorkerSummary.findOne({ where: { ownerId: req.user.id, date: today } });
    res.json(record || null);
  } catch (err) {
    next(err);
  }
};
