const { sequelize, Owner, DailyWorkerSummary, DailyWorkerPayment, DailyWorkerGroup } = require('../models');
const { Op } = require('sequelize');

/**
 * Ensures strict multi-tenant isolation:
 * - An Owner can only access/manage their own data (req.user.id).
 * - An Admin can only access/manage data for owners created by THAT specific admin (Owner.adminId === req.user.id).
 * - Another admin or another owner is blocked with 403 Forbidden.
 */
const getAuthorizedOwnerId = async (req) => {
  if (req.user.role === 'owner') {
    return req.user.id;
  }
  if (req.user.role === 'admin') {
    const requestedOwnerId = req.query.ownerId || req.body.ownerId;
    if (requestedOwnerId) {
      const owner = await Owner.findOne({
        where: { id: requestedOwnerId, adminId: req.user.id }
      });
      if (!owner) {
        const err = new Error('Access denied: You can only check or update records for owners created by your admin account.');
        err.statusCode = 403;
        throw err;
      }
      return owner.id;
    }
    // If no ownerId passed by admin, resolve first owner managed by this admin
    const firstOwner = await Owner.findOne({
      where: { adminId: req.user.id },
      order: [['id', 'ASC']]
    });
    if (!firstOwner) {
      const err = new Error('No owners found under your admin account. Please create an owner first.');
      err.statusCode = 404;
      throw err;
    }
    return firstOwner.id;
  }
  const err = new Error('Unauthorized role');
  err.statusCode = 403;
  throw err;
};

exports.createOrUpdate = async (req, res, next) => {
  try {
    const ownerId = await getAuthorizedOwnerId(req);
    const { date, totalWorkers, dailyAmount, totalPaid, groups } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    let finalTotalWorkers = parseFloat(totalWorkers) || 0;
    let finalDailyAmount = parseFloat(dailyAmount) || 0;
    let finalTotalWage = 0;

    // Check if an existing record is in DB to preserve paid amounts on group edits
    const existingRecord = await DailyWorkerSummary.findOne({ where: { ownerId, date } });
    const existingGroups = (existingRecord && Array.isArray(existingRecord.groups)) ? existingRecord.groups : [];

    let processedGroups = [];
    if (Array.isArray(groups) && groups.length > 0) {
      let calcWorkers = 0;
      let calcWage = 0;
      let calcTotalPaid = 0;

      processedGroups = groups.map((g, idx) => {
        // Match existing group by ID or Name
        const matchedExisting = existingGroups.find(eg =>
          (eg.id && g.id && String(eg.id) === String(g.id)) ||
          (eg.name && g.name && eg.name.trim().toLowerCase() === g.name.trim().toLowerCase())
        );

        let groupPresentWorkers = 0;
        let groupRate = 0;

        // If this group was already submitted before and user is NOT admin, PREVIOUS GROUP IS BLOCKED
        if (matchedExisting && req.user.role !== 'admin') {
          groupPresentWorkers = parseFloat(matchedExisting.workerCount !== undefined ? matchedExisting.workerCount : (matchedExisting.totalWorkers || 0)) || 0;
          groupRate = parseFloat(matchedExisting.dailyRate !== undefined ? matchedExisting.dailyRate : (matchedExisting.dailyAmount || 0));
        } else {
          // New group or admin edit
          if (g.workerCount !== undefined && g.workerCount !== '') {
            groupPresentWorkers = parseFloat(g.workerCount) || 0;
          } else if (g.totalWorkers !== undefined && g.totalWorkers !== '') {
            groupPresentWorkers = parseFloat(g.totalWorkers) || 0;
          } else if (Array.isArray(g.members) && g.members.length > 0) {
            groupPresentWorkers = g.members.filter(m => m.attendance === 'present' || m.present === true).length;
          }
          groupRate = parseFloat(g.dailyRate !== undefined ? g.dailyRate : (g.dailyAmount || 0));
        }

        const groupWage = groupPresentWorkers * groupRate;
        const groupPaid = matchedExisting ? (parseFloat(matchedExisting.totalPaid) || 0) : (parseFloat(g.totalPaid) || 0);
        calcWorkers += groupPresentWorkers;
        calcWage += groupWage;
        calcTotalPaid += groupPaid;

        return {
          id: matchedExisting ? matchedExisting.id : (g.id || `grp_${idx + 1}_${Date.now()}`),
          name: (g.name || `Group ${idx + 1}`).trim(),
          dailyRate: groupRate,
          workerCount: groupPresentWorkers,
          totalWage: groupWage,
          totalPaid: groupPaid,
          remaining: Math.max(0, groupWage - groupPaid),
          submitted: true
        };
      });

      // Ensure any previously submitted groups that weren't in the incoming payload are preserved intact for non-admin
      if (req.user.role !== 'admin') {
        existingGroups.forEach(eg => {
          const alreadyPresent = processedGroups.some(pg =>
            (pg.id && eg.id && String(pg.id) === String(eg.id)) ||
            (pg.name && eg.name && pg.name.trim().toLowerCase() === eg.name.trim().toLowerCase())
          );
          if (!alreadyPresent) {
            const egCount = parseFloat(eg.workerCount !== undefined ? eg.workerCount : (eg.totalWorkers || 0)) || 0;
            const egRate = parseFloat(eg.dailyRate !== undefined ? eg.dailyRate : (eg.dailyAmount || 0));
            const egWage = parseFloat(eg.totalWage !== undefined ? eg.totalWage : (egCount * egRate));
            const egPaid = parseFloat(eg.totalPaid || 0);
            calcWorkers += egCount;
            calcWage += egWage;
            calcTotalPaid += egPaid;

            processedGroups.push({
              ...eg,
              workerCount: egCount,
              dailyRate: egRate,
              totalWage: egWage,
              totalPaid: egPaid,
              remaining: Math.max(0, egWage - egPaid),
              submitted: true
            });
          }
        });
      }

      finalTotalWorkers = calcWorkers;
      finalTotalWage = calcWage;
      finalDailyAmount = finalTotalWorkers > 0 ? (finalTotalWage / finalTotalWorkers) : finalDailyAmount;

      const paid = existingRecord ? Math.max(parseFloat(existingRecord.totalPaid || 0), calcTotalPaid) : (parseFloat(totalPaid) || calcTotalPaid);
      const remaining = Math.max(0, finalTotalWage - paid);

      const [record, created] = await DailyWorkerSummary.findOrCreate({
        where: { ownerId, date },
        defaults: {
          totalWorkers: finalTotalWorkers,
          dailyAmount: finalDailyAmount,
          totalWage: finalTotalWage,
          totalPaid: paid,
          remaining,
          groups: processedGroups
        }
      });

      if (!created) {
        record.totalWorkers = finalTotalWorkers;
        record.dailyAmount = finalDailyAmount;
        record.totalWage = finalTotalWage;
        record.totalPaid = paid;
        record.remaining = remaining;
        record.groups = processedGroups;
        record.changed('groups', true);
        await record.save();
      }

      // Automatically store/persist new groups under this owner
      for (const pg of processedGroups) {
        if (pg.name && pg.name.trim()) {
          try {
            const existingGrp = await DailyWorkerGroup.findOne({
              where: {
                ownerId,
                name: { [Op.iLike]: pg.name.trim() }
              }
            });
            if (!existingGrp) {
              await DailyWorkerGroup.create({
                ownerId,
                name: pg.name.trim(),
                defaultDailyRate: pg.dailyRate || 400
              });
            }
          } catch (e) {
            // Ignore if already exists or concurrent insertion
          }
        }
      }

      return res.json(record);
    } else {
      if (!totalWorkers || !dailyAmount) return res.status(400).json({ message: 'Required fields missing' });
      finalTotalWage = finalTotalWorkers * finalDailyAmount;
      const paid = parseFloat(totalPaid) || 0;
      const remaining = Math.max(0, finalTotalWage - paid);

      const [record, created] = await DailyWorkerSummary.findOrCreate({
        where: { ownerId, date },
        defaults: {
          totalWorkers: finalTotalWorkers,
          dailyAmount: finalDailyAmount,
          totalWage: finalTotalWage,
          totalPaid: paid,
          remaining,
          groups: []
        }
      });

      if (!created) {
        record.totalWorkers = finalTotalWorkers;
        record.dailyAmount = finalDailyAmount;
        record.totalWage = finalTotalWage;
        record.totalPaid = paid;
        record.remaining = remaining;
        record.groups = [];
        await record.save();
      }

      return res.json(record);
    }
  } catch (err) {
    next(err);
  }
};

exports.addPayment = async (req, res, next) => {
  let transaction;
  try {
    const ownerId = await getAuthorizedOwnerId(req);
    transaction = await sequelize.transaction();
    const { date, startDate, endDate, amount, notes, paymentMethod, groupName } = req.body;
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Valid payment amount is required' });
    }

    const whereClause = { ownerId };
    if (startDate && endDate) {
      if (startDate > endDate) {
        await transaction.rollback();
        return res.status(400).json({ message: 'Start date cannot be after end date' });
      }
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.date = { [Op.lte]: endDate };
    }

    const records = await DailyWorkerSummary.findAll({
      where: whereClause,
      order: [['date', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (records.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Daily worker records not found for this date range' });
    }

    const rangeStart = startDate || records[0].date;
    const rangeEnd = endDate || records[records.length - 1].date;

    const cleanGroupName = (groupName && groupName !== 'All' && groupName.trim() !== '') ? groupName.trim() : null;

    if (cleanGroupName) {
      // ── GROUP-SPECIFIC PAYMENT ALLOCATION ──
      let groupTotalDue = 0;
      records.forEach(r => {
        if (Array.isArray(r.groups)) {
          const g = r.groups.find(grp => (grp.name || '').trim().toLowerCase() === cleanGroupName.toLowerCase());
          if (g) {
            const due = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max((parseFloat(g.totalWage || 0) - parseFloat(g.totalPaid || 0)), 0);
            groupTotalDue += due;
          }
        }
      });

      if (groupTotalDue <= 0) {
        await transaction.rollback();
        return res.status(400).json({ message: `No remaining payment due for group "${cleanGroupName}" in this date range` });
      }

      if (paymentAmount > groupTotalDue) {
        await transaction.rollback();
        return res.status(400).json({ message: `Payment amount (₹${paymentAmount}) cannot be greater than group remaining due (₹${groupTotalDue})` });
      }

      let amountLeft = paymentAmount;
      for (const record of records) {
        if (amountLeft <= 0) break;
        if (!Array.isArray(record.groups) || record.groups.length === 0) continue;

        let recordApplied = 0;
        const updatedGroups = record.groups.map(g => {
          if ((g.name || '').trim().toLowerCase() === cleanGroupName.toLowerCase() && amountLeft > 0) {
            const gWage = parseFloat(g.totalWage || 0);
            const gPaid = parseFloat(g.totalPaid || 0);
            const gRem = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max(gWage - gPaid, 0);
            if (gRem > 0) {
              const applied = Math.min(gRem, amountLeft);
              amountLeft -= applied;
              recordApplied += applied;
              const nextPaid = gPaid + applied;
              return {
                ...g,
                totalPaid: nextPaid,
                remaining: Math.max(0, gWage - nextPaid)
              };
            }
          }
          return g;
        });

        if (recordApplied > 0) {
          record.groups = updatedGroups;
          record.changed('groups', true);
          const totalPaid = parseFloat(record.totalPaid || 0) + recordApplied;
          record.totalPaid = totalPaid;
          record.remaining = Math.max(parseFloat(record.totalWage || 0) - totalPaid, 0);
          await record.save({ transaction });
        }
      }
    } else {
      // ── GENERAL PAYMENT (ACROSS ALL GROUPS IN ORDER) ──
      const totalDue = records.reduce((sum, r) => sum + parseFloat(r.remaining || 0), 0);
      if (paymentAmount > totalDue) {
        await transaction.rollback();
        return res.status(400).json({ message: `Payment amount exceeds total remaining dues (₹${totalDue})` });
      }

      let amountLeft = paymentAmount;
      for (const record of records) {
        if (amountLeft <= 0) break;
        const rem = parseFloat(record.remaining || 0);
        if (rem <= 0) continue;

        const applied = Math.min(rem, amountLeft);
        const totalPaid = parseFloat(record.totalPaid || 0) + applied;
        record.totalPaid = totalPaid;
        record.remaining = Math.max(parseFloat(record.totalWage || 0) - totalPaid, 0);

        if (Array.isArray(record.groups) && record.groups.length > 0) {
          let recLeft = applied;
          record.groups = record.groups.map(g => {
            if (recLeft <= 0) return g;
            const gWage = parseFloat(g.totalWage || 0);
            const gPaid = parseFloat(g.totalPaid || 0);
            const gRem = g.remaining !== undefined ? Math.max(parseFloat(g.remaining || 0), 0) : Math.max(gWage - gPaid, 0);
            if (gRem > 0) {
              const grpApplied = Math.min(gRem, recLeft);
              recLeft -= grpApplied;
              const nextPaid = gPaid + grpApplied;
              return {
                ...g,
                totalPaid: nextPaid,
                remaining: Math.max(0, gWage - nextPaid)
              };
            }
            return g;
          });
          record.changed('groups', true);
        }

        amountLeft -= applied;
        await record.save({ transaction });
      }
    }

    const payment = await DailyWorkerPayment.create({
      ownerId,
      startDate: rangeStart,
      endDate: rangeEnd,
      paymentDate: date || new Date().toISOString().split('T')[0],
      amount: paymentAmount,
      notes,
      paymentMethod: paymentMethod || 'Cash',
      groupName: cleanGroupName
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
    const ownerId = await getAuthorizedOwnerId(req);
    const { startDate, endDate, date } = req.query;
    const where = { ownerId };
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
    const ownerId = await getAuthorizedOwnerId(req);
    const { startDate, endDate, date } = req.query;
    const where = { ownerId };

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
    const ownerId = await getAuthorizedOwnerId(req);
    const today = new Date().toISOString().split('T')[0];
    const record = await DailyWorkerSummary.findOne({ where: { ownerId, date: today } });
    res.json(record || null);
  } catch (err) {
    next(err);
  }
};

// ─── PERMANENT / STORED WORK GROUPS ──────────────────────────────────────────
exports.getStoredGroups = async (req, res, next) => {
  try {
    let targetOwnerId;

    if (req.user.role === 'owner') {
      targetOwnerId = req.user.id;
    } else if (req.user.role === 'admin') {
      if (req.query.ownerId) {
        // Verify owner was created by this specific admin
        const owner = await Owner.findOne({
          where: { id: req.query.ownerId, adminId: req.user.id }
        });
        if (!owner) {
          return res.status(403).json({ message: 'Access denied: You can only view groups for owners created by your admin account.' });
        }
        targetOwnerId = owner.id;
      } else {
        // If no ownerId specified by admin, fetch groups across all owners created by this admin
        const managedOwners = await Owner.findAll({
          where: { adminId: req.user.id },
          attributes: ['id']
        });
        const managedOwnerIds = managedOwners.map(o => o.id);
        if (managedOwnerIds.length === 0) {
          return res.json([]);
        }
        const stored = await DailyWorkerGroup.findAll({
          where: { ownerId: { [Op.in]: managedOwnerIds } },
          include: [{ model: Owner, as: 'owner', attributes: ['id', 'name', 'username'] }],
          order: [['id', 'ASC']]
        });
        return res.json(stored);
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized role' });
    }

    let stored = await DailyWorkerGroup.findAll({
      where: { ownerId: targetOwnerId },
      include: [{ model: Owner, as: 'owner', attributes: ['id', 'name', 'username'] }],
      order: [['id', 'ASC']]
    });

    return res.json(stored);
  } catch (err) {
    next(err);
  }
};

exports.createStoredGroup = async (req, res, next) => {
  try {
    const { name, defaultDailyRate } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }
    const ownerId = await getAuthorizedOwnerId(req);
    const cleanName = name.trim();
    const existing = await DailyWorkerGroup.findOne({
      where: {
        ownerId,
        name: { [Op.iLike]: cleanName }
      }
    });
    if (existing) {
      return res.status(400).json({ message: `Group "${cleanName}" already exists for this owner` });
    }

    const newGroup = await DailyWorkerGroup.create({
      ownerId,
      name: cleanName,
      defaultDailyRate: parseFloat(defaultDailyRate) || 400
    });
    res.status(201).json(newGroup);
  } catch (err) {
    next(err);
  }
};

exports.updateStoredGroup = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an Admin can edit or update created groups.' });
    }
    const { id } = req.params;
    const { name, defaultDailyRate } = req.body;
    const group = await DailyWorkerGroup.findByPk(id, {
      include: [{ model: Owner, as: 'owner', attributes: ['id', 'adminId', 'name', 'username'] }]
    });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Security check: Only the admin who created this owner can check or update this group!
    if (!group.owner || group.owner.adminId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only edit groups for owners created by your admin account. Another admin or owner cannot update this.' });
    }

    if (name && name.trim()) {
      group.name = name.trim();
    }
    if (defaultDailyRate !== undefined) {
      group.defaultDailyRate = parseFloat(defaultDailyRate) || 0;
    }
    await group.save();
    res.json(group);
  } catch (err) {
    next(err);
  }
};

exports.deleteStoredGroup = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only an Admin can delete created groups.' });
    }
    const { id } = req.params;
    const group = await DailyWorkerGroup.findByPk(id, {
      include: [{ model: Owner, as: 'owner', attributes: ['id', 'adminId'] }]
    });
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Security check: Only the admin who created this owner can delete this group!
    if (!group.owner || group.owner.adminId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied: You can only delete groups for owners created by your admin account. Another admin or owner cannot delete this.' });
    }

    await group.destroy();
    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    next(err);
  }
};
