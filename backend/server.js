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
const { sequelize } = require('./models');
const seedAdmin = require('./utils/seed');
const { protect } = require('./middleware/auth');

const app = express();

// Security middleware

// By default, helmet sets Cross-Origin-Resource-Policy to 'same-origin',
// which blocks the frontend from loading images from the backend's /uploads folder.
// We adjust it to 'cross-origin' to allow this.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 UNHANDLED ERROR:', err);
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.statusCode || 500).json({
    status: 'error',
    message: isDevelopment ? err.message : 'Internal server error',
    stack: isDevelopment ? err.stack : undefined,
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
