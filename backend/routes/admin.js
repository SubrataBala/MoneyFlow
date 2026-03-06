const router = require('express').Router();
const { authorize } = require('../middleware/auth');
const { createOwner, getAllOwners, toggleOwnerStatus, resetOwnerPassword, deleteOwner, getTenantDataForOwner, deleteLandOwner, deleteLandRecord, updateLandRecord, deleteLandPayment, updateLandPayment, getFertilizerDataForOwner, deleteFertilizerShopkeeper, deleteFertilizerPurchase, deleteFertilizerPayment, updateFertilizerPurchase, updateFertilizerPayment, getDieselDataForOwner, deleteDieselPump, deleteDieselPurchase, deleteDieselPayment, updateDieselPurchase, updateDieselPayment, getDailySummaryForOwner, updateDailySummary, deleteDailySummary } = require('../controllers/adminController');

// The global 'protect' middleware in server.js handles authentication.
// We only need to add role-based authorization here.
router.use(authorize('admin'));
router.post('/owners', createOwner);
router.get('/owners', getAllOwners);
router.put('/owners/:id/toggle-status', toggleOwnerStatus);
router.put('/owners/:id/reset-password', resetOwnerPassword);
router.delete('/owners/:id', deleteOwner);

// Routes for admin to manage tenant data
router.get('/tenants/data', getTenantDataForOwner);
router.delete('/tenants/owners/:id', deleteLandOwner);
router.delete('/tenants/lands/:id', deleteLandRecord);
router.put('/tenants/lands/:id', updateLandRecord);
router.delete('/tenants/payments/:id', deleteLandPayment);
router.put('/tenants/payments/:id', updateLandPayment);

// Routes for admin to manage fertilizer data
router.get('/fertilizer/data', getFertilizerDataForOwner);
router.delete('/fertilizer/shopkeepers/:id', deleteFertilizerShopkeeper);
router.delete('/fertilizer/purchases/:id', deleteFertilizerPurchase);
router.put('/fertilizer/purchases/:id', updateFertilizerPurchase);
router.delete('/fertilizer/payments/:id', deleteFertilizerPayment);
router.put('/fertilizer/payments/:id', updateFertilizerPayment);


// Routes for admin to manage diesel data
router.get('/diesel/data', getDieselDataForOwner);
router.delete('/diesel/pumps/:id', deleteDieselPump);
router.delete('/diesel/purchases/:id', deleteDieselPurchase);
router.put('/diesel/purchases/:id', updateDieselPurchase);
router.delete('/diesel/payments/:id', deleteDieselPayment);
router.put('/diesel/payments/:id', updateDieselPayment);

// Routes for admin to manage daily summaries
router.get('/daily-summary/data', getDailySummaryForOwner);
router.put('/daily-summary/:id', updateDailySummary);
router.delete('/daily-summary/:id', deleteDailySummary);

module.exports = router;
