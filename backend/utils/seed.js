const { Admin } = require('../models');
require('dotenv').config();

async function seedAdmin() {
  try {
    const existing = await Admin.findOne({ where: { username: process.env.ADMIN_USERNAME || 'admin' } });
    if (!existing) {
      await Admin.create({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        role: 'admin'
      });
      console.log('✅ Admin created:', process.env.ADMIN_USERNAME || 'admin');
    } else {
      console.log('ℹ️  Admin already exists');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
}

module.exports = seedAdmin;
