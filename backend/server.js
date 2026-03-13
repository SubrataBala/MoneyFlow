require('dotenv').config();
const express = require('express');
const path = require('path');

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in the .env file.');
  process.exit(1);
}

const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { sequelize, Owner, Labour, Attendance, DailyWorkerSummary, FertilizerShopkeeper, FertilizerPurchase, FertilizerPayment, DieselPump, DieselPurchase, DieselPayment, LandOwner } = require('./models');
const seedAdmin = require('./utils/seed');
const { protect, authorize } = require('./middleware/auth');

const app = express();

// Security middleware

// By default, helmet sets Cross-Origin-Resource-Policy to 'same-origin',
// which blocks the frontend from loading images from the backend's /uploads folder.
// We adjust it to 'cross-origin' to allow this.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://erp-frontend-yjo0.onrender.com" // Your deployed frontend URL
  ],
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// Serve static files from the 'public/uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// This middleware is a robust workaround for a common frontend issue where the API prefix
// is accidentally duplicated (e.g., /api/api/...). It intelligently corrects the request
// path before it reaches the routers, making the backend resilient to this specific
// frontend configuration error.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/api/')) { // Check for the duplicated prefix
    const originalUrl = req.url;
    req.url = req.url.substring(4); // Correct the path by removing the extra '/api'
    console.log(`[URL Fix] Rewriting requested URL from "${originalUrl}" to "${req.url}"`);
  }
  next();
});

// Rate limiting
// NOTE: Rate limiting has been disabled for local development as requested.
// You can re-enable this for production if needed.

// Special route handler for cascading owner deletion.
// This is placed before the generic /api/admin router to ensure it's matched first.
app.delete('/api/admin/owners/:id', protect, authorize('admin'), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const ownerId = req.params.id;
    const owner = await Owner.findByPk(ownerId, { transaction: t });
    if (!owner) {
      await t.rollback();
      return res.status(404).json({ message: 'Owner not found' });
    }

    // SECURITY: Enforce that an owner must be deactivated before deletion.
    if (owner.activeStatus) {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot delete an active owner. Please deactivate the account first.' });
    }

    // Manually cascade deletes for all data associated with the owner.
    // Sequelize will handle nested cascades (e.g., LandRecords from LandOwner)
    // if the models are defined with `onDelete: 'CASCADE'`.

    // Tenant Management Data
    await LandOwner.destroy({ where: { ownerId }, transaction: t });
    // Diesel Management Data (Note: uses capital 'OwnerId')
    await DieselPump.destroy({ where: { OwnerId: ownerId }, transaction: t });
    await DieselPurchase.destroy({ where: { OwnerId: ownerId }, transaction: t });
    await DieselPayment.destroy({ where: { OwnerId: ownerId }, transaction: t });
    // Fertilizer Management Data
    await FertilizerShopkeeper.destroy({ where: { ownerId }, transaction: t });
    await FertilizerPurchase.destroy({ where: { ownerId }, transaction: t });
    await FertilizerPayment.destroy({ where: { ownerId }, transaction: t });

    // Labour & Attendance Data
    // We must delete attendance records before deleting the labours they reference.
    // 1. Find all labour IDs for the owner being deleted.
    const laboursToDelete = await Labour.findAll({
      where: { ownerId },
      attributes: ['id'], // We only need the IDs for the next step.
      transaction: t,
    });
    const labourIds = laboursToDelete.map(l => l.id);

    // 2. If labours exist, delete all their associated attendance records.
    if (labourIds.length > 0) {
      await Attendance.destroy({ where: { labourId: labourIds }, transaction: t });
    }

    // Labour & Daily Worker Data
    await Labour.destroy({ where: { ownerId }, transaction: t });
    await DailyWorkerSummary.destroy({ where: { ownerId }, transaction: t });

    // Finally, delete the owner itself.
    await owner.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Owner and all associated data have been permanently deleted.' });
  } catch (err) {
    await t.rollback();
    next(err); // Pass to the global error handler
  }
});

// Public routes (no authentication needed)
app.use('/api/auth', require('./routes/auth'));

// Protected routes (all routes below this require a valid JWT)
// This mounts each router on its own specific path, ensuring that requests
// like GET /api/admin/owners are correctly handled by the admin router.
app.use('/api/admin', protect, require('./routes/admin'));
app.use('/api/labour', protect, require('./routes/labour'));
app.use('/api/daily-worker', protect, require('./routes/dailyWorker'));
app.use('/api/fertilizer', protect, require('./routes/fertilizer'));
app.use('/api/tenants', protect, require('./routes/tenants'));
app.use('/api/diesel', protect, require('./routes/diesel'));
app.use('/api/dashboard', protect, require('./routes/dashboard'));

app.get("/", (req, res) => {
  res.send("MoneyFlow API is running 🚀");
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => {
  console.warn(`[404 Not Found] - Path: ${req.originalUrl} - Method: ${req.method}`);
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 UNHANDLED ERROR:', err);
  let error = { ...err };
  error.message = err.message;
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle specific JWT errors for better client-side feedback
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error.statusCode = 401;
    error.message = 'Your session is invalid or has expired. Please log in again.';
  }

  // Handle Sequelize foreign key errors for user-friendly feedback
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error.statusCode = 400; // Bad Request
    // Provides a clear, actionable message to the user.
    error.message = `Cannot complete operation. The selected item is still referenced by other records (e.g., in table '${err.table}'). Please remove the associated data first.`;
  }

  res.status(error.statusCode || 500).json({
    message: isProduction && !error.statusCode ? 'An unexpected error occurred on the server.' : error.message,
    stack: isProduction ? undefined : err.stack, // Only show stack in development
  });
});

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');
    await sequelize.sync({ alter: true });
    console.log('✅ Database synced');
    await seedAdmin();
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    if (err.name === 'SequelizeHostNotFoundError') {
      console.error('❌ Database connection failed: Host not found.');
      console.error('❌ This usually means the DATABASE_URL in your .env file is incorrect.');
      console.error('❌ Please ensure it is in the format: postgres://USER:PASSWORD@HOST:PORT/DATABASE');
      console.error(`❌ The application is trying to connect to host: "${err.parent.hostname}" which is not a valid address.`);
    } else if (err.name === 'SequelizeConnectionError' && err.message.includes('SSL/TLS required')) {
      console.error('❌ Database connection failed: The database server requires an SSL/TLS connection.');
      console.error('💡 To fix this, you may need to update your Sequelize configuration to enable SSL.');
      console.error('💡 Option 1: Add `?ssl=true` to your DATABASE_URL in the .env file.');
      console.error('   Example: postgres://USER:PASSWORD@HOST:PORT/DATABASE?ssl=true');
      console.error('💡 Option 2: Add `dialectOptions` to your Sequelize configuration (likely in `models/index.js`).');
      console.error('   Example `dialectOptions`: { ssl: { require: true, rejectUnauthorized: false } }');
    }
    console.error('\n❌ Full error details:', err);
    process.exit(1);
  }
}

startServer();
