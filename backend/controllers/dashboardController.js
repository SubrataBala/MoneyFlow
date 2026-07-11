const { sequelize, Attendance, Labour, DailyWorkerSummary, FertilizerPayment, DieselPayment, LandPayment, LandOwner } = require('../models');

/**
 * Gathers total payments across all categories for the logged-in owner.
 * This provides an efficient way for the dashboard to get all the data it needs
 * in a single API call.
 */
exports.getPaymentSummary = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    // Normal-worker expense is the wage recorded for present attendance, even when
    // that wage has not yet been paid. Attendance has no direct ownerId, so filter
    // through its related Labour record.
    const labourPromise = Attendance.sum('dailyWage', {
      where: { attendance: 'present' },
      include: [{
        model: Labour,
        as: 'labour',
        where: { ownerId },
        attributes: [] // We only need the join for filtering, not the attributes.
      }]
    });
    const dailyWorkerPromise = DailyWorkerSummary.sum('totalPaid', { where: { ownerId } });
    const fertilizerPromise = FertilizerPayment.sum('amount_paid', { where: { ownerId } });
    const dieselPromise = DieselPayment.sum('amount', { where: { OwnerId: ownerId } });

    // For land tenants, we need to join through the LandOwner model to filter by the main owner.
    const landTenantPromise = LandPayment.sum('amountPaid', {
      include: [{
        model: LandOwner,
        as: 'owner',
        where: { ownerId },
        attributes: [] // We don't need any attributes from LandOwner, just the join.
      }]
    });

    const [
      labourTotal,
      dailyWorkerTotal,
      fertilizerTotal,
      dieselTotal,
      landTenantTotal
    ] = await Promise.all([
      labourPromise,
      dailyWorkerPromise,
      fertilizerPromise,
      dieselPromise,
      landTenantPromise
    ]);

    res.json({
      labour: labourTotal || 0,
      dailyWorkers: dailyWorkerTotal || 0,
      fertilizer: fertilizerTotal || 0,
      diesel: dieselTotal || 0,
      landTenants: landTenantTotal || 0,
    });

  } catch (err) {
    next(err);
  }
};
