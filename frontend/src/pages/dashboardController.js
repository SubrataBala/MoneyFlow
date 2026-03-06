const { sequelize, Attendance, DailyWorkerSummary, FertilizerPayment, DieselPayment, LandPayment, LandOwner } = require('../models');

/**
 * Gathers total payments across all categories for the logged-in owner.
 * This provides an efficient way for the dashboard to get all the data it needs
 * in a single API call.
 */
exports.getPaymentSummary = async (req, res, next) => {
  try {
    const ownerId = req.user.id;

    // Use Model.sum() for a clean and performant way to get the total for a column.
    // Note: We assume Attendance has a direct ownerId for performance, which is a common pattern.
    // If not, a JOIN through the Labour model would be required.
    const labourPromise = Attendance.sum('amountPaidToday', { where: { ownerId } });
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