const express = require('express');
// Import the new `authorize` middleware. The global `protect` middleware handles authentication.
const { authorize } = require('../middleware/auth');
const {
  getData,
  addShopkeeper,
  updateShopkeeper,
  deleteShopkeeper,
  addPurchase,
  updatePurchase,
  deletePurchase,
  addPayment,
  deletePayment,
} = require('../controllers/fertilizerController');
const upload = require('../middleware/upload');

const router = express.Router();

// All routes in this file are for owners only.
router.use(authorize('owner'));

router.get('/data', getData);

router.post('/shopkeepers', addShopkeeper);
router.put('/shopkeepers/:id', updateShopkeeper);
router.delete('/shopkeepers/:id', deleteShopkeeper);

router.post('/purchases', upload.single('slip_image'), addPurchase);
router.put('/purchases/:id', upload.single('slip_image'), updatePurchase);
router.delete('/purchases/:id', deletePurchase);

router.post('/payments', addPayment);
router.delete('/payments/:id', deletePayment);

module.exports = router;