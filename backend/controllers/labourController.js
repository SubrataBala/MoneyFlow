const { Labour, Attendance, Owner, sequelize } = require('../models');
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
const findLabourForAdmin = async (id) => {
  const labour = await Labour.findByPk(id);
  if (!labour) {
    const error = new Error('Labour not found');
    error.status = 404;
    throw error;
  }
  return labour;
};

exports.deleteLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id);
    labour.isActive = false;
    await labour.save();
    res.json({ message: 'Labour deactivated' });
  } catch (err) {
    next(err);
  }
};

exports.adminReactivateLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id);
    labour.isActive = true;
    await labour.save();
    res.json({ message: 'Labour reactivated' });
  } catch (err) {
    next(err);
  }
};

exports.adminPermanentlyDeleteLabour = async (req, res, next) => {
  try {
    const labour = await findLabourForAdmin(req.params.id);
    if (labour.isActive) return res.status(400).json({ message: 'Cannot permanently delete an active labourer. Deactivate first.' });
    await labour.destroy();
    res.json({ message: 'Labour permanently deleted' });
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
      // If record already exists, owner can update wage/paid, but not attendance status.
      if (attendance && record.attendance !== attendance) {
        return res.status(403).json({ message: 'Attendance status is locked. Only an admin can change it.' });
      }
      record.dailyWage = dailyWage ?? record.dailyWage;
      record.amountPaidToday = amountPaidToday ?? record.amountPaidToday;
      await record.save();
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

    const labour = await Labour.findByPk(labourId);
    if (!labour) return res.status(404).json({ message: 'Labour not found' });

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

    const attendanceRecords = await Attendance.findAll({ where: { labourId }, order: [['date', 'DESC']] });
    
    const presentDays = attendanceRecords.filter(r => r.attendance === 'present').length;
    const totalWage = attendanceRecords.reduce((sum, r) => {
      return r.attendance === 'present' ? sum + parseFloat(r.dailyWage || 0) : sum;
    }, 0);
    const totalPaid = attendanceRecords.reduce((sum, r) => sum + parseFloat(r.amountPaidToday || 0), 0);
    const remaining = totalWage - totalPaid;

    // Explicitly convert records to plain objects to ensure all fields, including `accommodationProvided`, are sent.
    const records = attendanceRecords.map(r => r.get({ plain: true }));

    res.json({ labour, presentDays, totalWage, totalPaid, remaining, records });
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
    if (date) {
      attendanceWhere.date = date;
    } else if (startDate && endDate) {
      attendanceWhere.date = { [Op.between]: [startDate, endDate] };
    }

    // 3. Fetch all relevant attendance records in a single query
    const allRecords = await Attendance.findAll({ where: attendanceWhere });

    // 4. Group records by labourId for efficient processing
    const recordsByLabour = allRecords.reduce((acc, record) => {
      if (!acc[record.labourId]) {
        acc[record.labourId] = [];
      }
      acc[record.labourId].push(record);
      return acc;
    }, {});

    // 5. Map labours to their summaries, avoiding N+1 database queries
    const result = labours.map(labour => {
      const records = recordsByLabour[labour.id] || []; // Use the grouped records
      const presentDays = records.filter(r => r.attendance === 'present').length;
      const totalWage = records.reduce((sum, r) => r.attendance === 'present' ? sum + parseFloat(r.dailyWage || 0) : sum, 0);
      const totalPaid = records.reduce((sum, r) => sum + parseFloat(r.amountPaidToday || 0), 0);
      return { labour, presentDays, totalWage, totalPaid, remaining: totalWage - totalPaid };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
