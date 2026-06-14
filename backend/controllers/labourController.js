const { Labour, Attendance, Owner, LabourPayment, sequelize } = require('../models');
const { Op } = require('sequelize');

exports.addLabour = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name required' });
    const labour = await Labour.create({ name, ownerId: req.user.id });
    res.status(201).json(labour);
  } catch (err) {
    next(err);
  }
};

// Helper function to process a labourer object and flatten its attendance details.
// This avoids duplicating the same mapping logic for both owners and admins.
const processLabourWithAttendance = (labour) => {
  const labourJson = labour.toJSON();
  const attendanceRecord = labourJson.attendances?.[0];
  delete labourJson.attendances; // Clean up the nested object.

  return {
    ...labourJson,
    attendance: attendanceRecord?.attendance || 'absent',
    dailyWage: attendanceRecord?.dailyWage || '',
    amountPaidToday: attendanceRecord?.amountPaidToday || '',
    isRecordSaved: !!attendanceRecord,
  };
};

exports.getLabours = async (req, res, next) => {
  try {
    const { search, ownerId, date } = req.query;
    const { role, id } = req.user;

    if (role === 'owner') {
      // Owners can only see their own active labours.
      // The `ownerId` query parameter is ignored for security.
      const where = { ownerId: id, isActive: true };
      if (search) where.name = { [Op.iLike]: `%${search}%` }; // Using iLike for case-insensitive search
      const labours = await Labour.findAll({
        where,
        include: [{
          model: Attendance,
          as: 'attendances',
          where: date ? { date } : undefined,
          required: false
        }],
        order: [['createdAt', 'ASC']]
      });

      return res.json(labours.map(processLabourWithAttendance));
    } else if (role === 'admin') {
      // Admins must provide an ownerId to specify which labours to view.
      if (!ownerId) {
        return res.status(400).json({ message: 'ownerId is required for admin users.' });
      }
      const where = { ownerId };
      if (search) where.name = { [Op.iLike]: `%${search}%` };

      const labours = await Labour.findAll({
        where,
        include: [
          { model: Owner, as: 'owner', attributes: ['name'] },
          {
            model: Attendance,
            as: 'attendances',
            where: date ? { date } : undefined,
            required: false
          }
        ],
        order: [['createdAt', 'ASC']],
      });

      return res.json(labours.map(processLabourWithAttendance));
    } else {
      // Fallback for any other role that might exist in the future.
      return res.status(403).json({ message: 'Forbidden' });
    }
  } catch (err) {
    next(err);
  }
};

// Helper function to reduce duplication in admin actions
const findLabourForAdmin = async (id, adminId) => {
  const labour = await Labour.findByPk(id, {
    include: { model: Owner, as: 'owner', attributes: ['id', 'adminId'] }
  });
  if (!labour) {
    const error = new Error('Labour not found');
    error.status = 404;
    throw error;
  }
  if (!labour.owner || labour.owner.adminId !== adminId) {
    const error = new Error('Access denied.');
    error.status = 403;
    throw error;
  }
  return labour;
};

exports.adminUpdateLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id, req.user.id);
    const { name, isActive } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Labour name is required.' });
    }

    labour.name = String(name).trim();
    if (typeof isActive === 'boolean') labour.isActive = isActive;
    await labour.save();
    res.json(labour);
  } catch (err) {
    next(err);
  }
};

exports.deleteLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id, req.user.id);
    labour.isActive = false;
    await labour.save();
    res.json({ message: 'Labour deactivated' });
  } catch (err) {
    next(err);
  }
};

exports.adminReactivateLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id, req.user.id);
    labour.isActive = true;
    await labour.save();
    res.json({ message: 'Labour reactivated' });
  } catch (err) {
    next(err);
  }
};

exports.adminPermanentlyDeleteLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id, req.user.id);
    if (labour.isActive) return res.status(400).json({ message: 'Cannot permanently delete an active labourer. Deactivate first.' });
    await labour.destroy();
    res.json({ message: 'Labour permanently deleted' });
  } catch (err) {
    next(err);
  }
};

exports.addLabourPayment = async (req, res, next) => {
  try {
    const { labourId, date, amount, notes, paymentMethod } = req.body;

    if (!labourId || !date || !amount) {
      return res.status(400).json({ message: 'Labour ID, date, and amount are required.' });
    }

    const labour = await Labour.findOne({ where: { id: labourId, ownerId: req.user.id } });
    if (!labour) {
      return res.status(404).json({ message: 'Labour not found or you do not have permission.' });
    }

    const payment = await LabourPayment.create({
      labourId,
      ownerId: req.user.id,
      date,
      amount,
      notes,
      paymentMethod,
    });

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
};

exports.markAttendance = async (req, res, next) => {
  try {
    const { labourId, date, attendance, dailyWage, amountPaidToday } = req.body;

    const labour = await Labour.findOne({ where: { id: labourId, ownerId: req.user.id } });
    if (!labour) return res.status(404).json({ message: 'Labour not found' });

    const [record, created] = await Attendance.findOrCreate({
      where: { labourId, date },
      defaults: { attendance: attendance || 'absent', dailyWage: dailyWage || 0, amountPaidToday: amountPaidToday || 0 }
    });

    if (!created) {
      return res.status(403).json({ message: 'Attendance record is locked. Only an admin can change it.' });
    }

    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateAttendance = async (req, res, next) => {
  try {
    // This is an admin-only function, so we don't check for ownerId on the labourer.
    const { labourId, date, attendance, dailyWage, amountPaidToday } = req.body;

    const labour = await Labour.findByPk(labourId, {
      include: { model: Owner, as: 'owner', attributes: ['id', 'adminId'] }
    });
    if (!labour) return res.status(404).json({ message: 'Labour not found' });
    if (!labour.owner || labour.owner.adminId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    const [record, created] = await Attendance.findOrCreate({
      where: { labourId, date },
      defaults: { attendance: attendance || 'absent', dailyWage: dailyWage || 0, amountPaidToday: amountPaidToday || 0 }
    });

    if (!created) {
      record.attendance = attendance ?? record.attendance;
      record.dailyWage = dailyWage ?? record.dailyWage;
      record.amountPaidToday = amountPaidToday ?? record.amountPaidToday;
      await record.save();
    }

    res.json(record);
  } catch (err) {
    next(err);
  }
};

exports.getWageSummary = async (req, res, next) => {
  try {
    const { labourId } = req.params;
    const labour = await Labour.findOne({ where: { id: labourId, ownerId: req.user.id } });
    if (!labour) return res.status(404).json({ message: 'Labour not found' });

    const [attendanceRecords, lumpSumPayments] = await Promise.all([
      Attendance.findAll({ where: { labourId }, order: [['date', 'DESC']] }),
      LabourPayment.findAll({ where: { labourId }, order: [['date', 'DESC']] })
    ]);
    
    const presentDays = attendanceRecords.filter(r => r.attendance === 'present').length;
    const totalWage = attendanceRecords.reduce((sum, r) => {
      return r.attendance === 'present' ? sum + parseFloat(r.dailyWage || 0) : sum;
    }, 0);

    const totalDailyPaid = attendanceRecords.reduce((sum, r) => sum + parseFloat(r.amountPaidToday || 0), 0);
    const totalLumpSumPaid = lumpSumPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalPaid = totalDailyPaid + totalLumpSumPaid;
    const balance = totalWage - totalPaid;
    const remaining = Math.max(balance, 0);
    const advance = Math.max(totalPaid - totalWage, 0);

    const dailyPayments = attendanceRecords
      .filter(r => parseFloat(r.amountPaidToday || 0) > 0)
      .map(r => ({
        id: `att-${r.id}`,
        type: 'daily',
        date: r.date,
        amount: r.amountPaidToday,
        notes: `Daily payment on ${r.date}`,
      }));

    const separatePayments = lumpSumPayments.map(p => ({
      id: `pay-${p.id}`,
      type: 'payment',
      date: p.date,
      amount: p.amount,
      notes: p.notes || `Payment via ${p.paymentMethod}`,
      paymentMethod: p.paymentMethod,
    }));

    const paymentHistory = [...dailyPayments, ...separatePayments].sort((a, b) => new Date(b.date) - new Date(a.date));

    const records = attendanceRecords.map(r => r.get({ plain: true }));

    res.json({ labour, presentDays, totalWage, totalPaid, remaining, advance, balance, records, paymentHistory });
  } catch (err) {
    next(err);
  }
};



exports.getAllWageSummary = async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;
    // 1. Fetch all active labourers for the owner
    const labours = await Labour.findAll({
      where: { ownerId: req.user.id, isActive: true },
      order: [['createdAt', 'ASC']] // Keep a consistent order
    });

    if (labours.length === 0) {
      return res.json([]);
    }

    const labourIds = labours.map(l => l.id);

    // 2. Build the where clause for attendance records
    const attendanceWhere = { labourId: { [Op.in]: labourIds } };
    const paymentWhere = { labourId: { [Op.in]: labourIds } };
    if (date) {
      attendanceWhere.date = date;
      paymentWhere.date = date;
    } else if (startDate && endDate) {
      attendanceWhere.date = { [Op.between]: [startDate, endDate] };
      paymentWhere.date = { [Op.between]: [startDate, endDate] };
    }

    // 3. Fetch all relevant attendance records in a single query
    const [allRecords, allPayments] = await Promise.all([
      Attendance.findAll({ where: attendanceWhere }),
      LabourPayment.findAll({ where: { labourId: { [Op.in]: labourIds } } }) // Fetch all payments regardless of date for accurate total remaining
    ]);

    // 4. Group records by labourId for efficient processing
    const recordsByLabour = allRecords.reduce((acc, record) => {
      if (!acc[record.labourId]) {
        acc[record.labourId] = [];
      }
      acc[record.labourId].push(record);
      return acc;
    }, {});

    const paymentsByLabour = allPayments.reduce((acc, payment) => {
      if (!acc[payment.labourId]) {
        acc[payment.labourId] = [];
      }
      acc[payment.labourId].push(payment);
      return acc;
    }, {});

    // 5. Map labours to their summaries, avoiding N+1 database queries
    const result = labours.map(labour => {
      const records = recordsByLabour[labour.id] || [];
      const payments = paymentsByLabour[labour.id] || [];
      const presentDays = records.filter(r => r.attendance === 'present').length;
      const totalWage = records.reduce((sum, r) => r.attendance === 'present' ? sum + parseFloat(r.dailyWage || 0) : sum, 0);
      const totalDailyPaid = records.reduce((sum, r) => sum + parseFloat(r.amountPaidToday || 0), 0);
      const totalLumpSumPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      const totalPaid = totalDailyPaid + totalLumpSumPaid;
      const balance = totalWage - totalPaid;
      return {
        labour,
        presentDays,
        totalWage,
        totalPaid,
        remaining: Math.max(balance, 0),
        advance: Math.max(totalPaid - totalWage, 0),
        balance
      };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
