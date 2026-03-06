const { sequelize, FertilizerShopkeeper, FertilizerPurchase, FertilizerPurchaseItem, FertilizerPayment } = require('../models');
const fs = require('fs');
const path = require('path');

exports.getData = async (req, res, next) => {
  try {
    const ownerFilter = { ownerId: req.user.id };
    const [shopkeepers, purchases, payments] = await Promise.all([
      FertilizerShopkeeper.findAll({ where: ownerFilter, order: [['name', 'ASC']] }),
      FertilizerPurchase.findAll({ where: ownerFilter, include: 'items', order: [['date', 'DESC']] }),
      FertilizerPayment.findAll({ where: ownerFilter, order: [['date', 'DESC']] })
    ]);
    res.json({ shopkeepers, purchases, payments });
  } catch (err) {
    next(err);
  }
};

// --- Shopkeepers ---
exports.addShopkeeper = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const shopkeeper = await FertilizerShopkeeper.create({ name, phone, address, ownerId: req.user.id });
    res.status(201).json(shopkeeper);
  } catch (err) {
    next(err);
  }
};

exports.updateShopkeeper = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const shopkeeper = await FertilizerShopkeeper.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });
    await shopkeeper.update({ name, phone, address });
    res.json(shopkeeper);
  } catch (err) {
    next(err);
  }
};

exports.deleteShopkeeper = async (req, res, next) => {
  try {
    const shopkeeper = await FertilizerShopkeeper.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!shopkeeper) return res.status(404).json({ message: 'Shopkeeper not found' });
    await shopkeeper.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

/**
 * Helper function to process and validate purchase items from a JSON string.
 * This centralizes logic used by both addPurchase and updatePurchase.
 * @param {string} itemsJSON - The JSON string of items from the request body.
 * @param {number} purchaseId - The ID of the parent purchase record.
 * @returns {Array} An array of validated and formatted purchase item objects.
 */
const processPurchaseItems = (itemsJSON, purchaseId) => {
  const parsedItems = JSON.parse(itemsJSON);
  if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
    throw new Error('Purchase must include at least one item.');
  }

  return parsedItems.map(item => {
    if (!item.name) {
      throw new Error("Each item in a purchase must have a 'name'.");
    }
    // Ensure quantity and rate are numbers, defaulting to 0 if invalid.
    const quantity = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    // The error "null value in column 'amount'" is because this calculation was missing.
    // We must calculate the total amount for each item and include it in the database record.
    const amount = quantity * rate;

    return { item_name: item.name, quantity, rate, amount, FertilizerPurchaseId: purchaseId };
  });
};

// --- Purchases ---
exports.addPurchase = async (req, res, next) => {
  // When using multipart/form-data, `items` will be a JSON string.
  const { shopkeeper_id, date, notes, items, total_amount } = req.body;
  const t = await sequelize.transaction();
  try {
    const purchase = await FertilizerPurchase.create({
      FertilizerShopkeeperId: shopkeeper_id,
      ownerId: req.user.id,
      date,
      notes,
      // The filename is provided by the `upload` middleware via `req.file`
      slip_filename: req.file ? req.file.filename : null,
      total_amount,
    }, { transaction: t });

    const purchaseItems = processPurchaseItems(items, purchase.id);
    await FertilizerPurchaseItem.bulkCreate(purchaseItems, { transaction: t });

    await t.commit();
    const result = await FertilizerPurchase.findByPk(purchase.id, { include: 'items' });
    res.status(201).json(result);
  } catch (err) {
    await t.rollback();
    // Provide a clearer error message for validation failures.
    if (err.message.includes('must have a') || err.message.includes('at least one item')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.updatePurchase = async (req, res, next) => {
  const { shopkeeper_id, date, notes, items, total_amount } = req.body;
  const t = await sequelize.transaction();
  try {
    const purchase = await FertilizerPurchase.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!purchase) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // If a new slip is uploaded, delete the old one.
    if (req.file && purchase.slip_filename) {
      const oldPath = path.join(__dirname, '../public/uploads', purchase.slip_filename);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err) {
        console.error("Failed to delete old slip image:", err);
      }
    }

    await purchase.update({
      FertilizerShopkeeperId: shopkeeper_id,
      date,
      notes,
      // Use new filename if provided, otherwise keep the existing one.
      slip_filename: req.file ? req.file.filename : purchase.slip_filename,
      total_amount,
    }, { transaction: t });

    await FertilizerPurchaseItem.destroy({ where: { FertilizerPurchaseId: purchase.id }, transaction: t });

    const purchaseItems = processPurchaseItems(items, purchase.id);
    await FertilizerPurchaseItem.bulkCreate(purchaseItems, { transaction: t });

    await t.commit();
    const result = await FertilizerPurchase.findByPk(purchase.id, { include: 'items' });
    res.json(result);
  } catch (err) {
    await t.rollback();
    if (err.message.includes('must have a') || err.message.includes('at least one item')) {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.deletePurchase = async (req, res, next) => {
  try {
    const purchase = await FertilizerPurchase.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!purchase) return res.status(404).json({ message: 'Purchase not found' });

    // If a slip image is associated, delete it from the filesystem.
    if (purchase.slip_filename) {
      const filePath = path.join(__dirname, '../public/uploads', purchase.slip_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await purchase.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// --- Payments ---
exports.addPayment = async (req, res, next) => {
  try {
    const { shopkeeper_id, date, amount_paid, notes } = req.body;
    const payment = await FertilizerPayment.create({
      FertilizerShopkeeperId: shopkeeper_id,
      ownerId: req.user.id,
      date,
      amount_paid,
      notes,
    });
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

exports.deletePayment = async (req, res, next) => {
  try {
    const payment = await FertilizerPayment.findOne({ where: { id: req.params.id, ownerId: req.user.id } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    await payment.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};