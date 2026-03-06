const bcrypt = require('bcryptjs');
const { sequelize, Owner, Labour, LandOwner, LandRecord, LandPayment, FertilizerShopkeeper, FertilizerPurchase, FertilizerPurchaseItem, FertilizerPayment, DieselPump, DieselPurchase, DieselPayment, DailyWorkerSummary } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');

exports.createOwner = async (req, res, next) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) return res.status(400).json({ message: 'All fields required' });

    const existing = await Owner.findOne({ where: { username } });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    // Pass the plain-text password directly to the create method.
    // The Owner model has a `beforeCreate` hook that will automatically and correctly hash the password.
    // Hashing it here would cause it to be double-hashed, preventing logins.
    const owner = await Owner.create({ username, password, name, role: 'owner', activeStatus: true });
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
    const records = await DailyWorkerSummary.findAll({
      where: { ownerId },
      order: [['date', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

exports.updateDailySummary = async (req, res, next) => {
  try {
    const record = await DailyWorkerSummary.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
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
    const count = await DailyWorkerSummary.destroy({ where: { id: req.params.id } });
    if (count === 0) return res.status(404).json({ message: 'Record not found' });
    res.status(204).send();
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
    const records = await DailyWorkerSummary.findAll({
      where: { ownerId },
      order: [['date', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    next(err);
  }
};

exports.updateDailySummary = async (req, res, next) => {
  try {
    const record = await DailyWorkerSummary.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ message: 'Record not found' });
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
    const count = await DailyWorkerSummary.destroy({ where: { id: req.params.id } });
    if (count === 0) return res.status(404).json({ message: 'Record not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getDieselDataForOwner = async (req, res, next) => {
  try {
    const { ownerId } = req.query;
    if (!ownerId) {
      return res.status(400).json({ message: 'ownerId is required' });
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
    const count = await DieselPump.destroy({ where: { id } });
    if (count === 0) return res.status(404).json({ message: 'Pump not found' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteDieselPurchase = async (req, res, next) => {
  try {
    const { id } = req.params;
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

    // Add a check to ensure the owner exists before proceeding.
    const owner = await Owner.findByPk(ownerId);
    if (!owner) {
      return res.status(404).json({ message: 'Owner account not found.' });
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
    await shopkeeper.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteFertilizerPurchase = async (req, res, next) => {
  try {
    const purchase = await FertilizerPurchase.findByPk(req.params.id);
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

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
    const record = await LandRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    await record.update(req.body);
    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.updateLandPayment = async (req, res, next) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
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
    await owner.destroy();
    res.status(204).send();
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
    const record = await LandRecord.findByPk(req.params.id);
    if (!record) return res.status(404).json({ message: 'Land Record not found' });
    await record.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.deleteLandPayment = async (req, res, next) => {
  try {
    const payment = await LandPayment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    await payment.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

exports.getAllOwners = async (req, res, next) => {
  try {
    const owners = await Owner.findAll({ attributes: { exclude: ['password'] }, order: [['createdAt', 'DESC']] });
    res.json(owners);
  } catch (err) {
    next(err);
  }
};

exports.toggleOwnerStatus = async (req, res, next) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    owner.activeStatus = !owner.activeStatus;
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
    const owner = await Owner.findByPk(req.params.id);
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
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ message: 'Owner not found' });
    await owner.destroy();
    res.json({ message: 'Owner deleted' });
  } catch (err) {
    next(err);
  }
};
