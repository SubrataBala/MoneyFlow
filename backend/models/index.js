'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

if (!process.env.DATABASE_URL) {
  console.error('FATAL ERROR: DATABASE_URL environment variable is not set. Please check your .env file.');
  process.exit(1);
}

const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const useSSL = process.env.DB_SSL === 'true' || (process.env.DB_SSL !== 'false' && !isLocalhost);
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true';

// Initialize Sequelize using the DATABASE_URL from your .env file
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries in the terminal
  // Enable SSL for cloud database providers like Supabase and Render, or when DB_SSL is true.
  dialectOptions: useSSL ? {
    ssl: {
      require: true,
      rejectUnauthorized
    }
  } : {},
  pool: {
    max: 10,
    min: 2, // Keep 2 warm connections open to eliminate 2-4 second TLS handshake latency
    idle: 300000, // Keep idle for 5 minutes
    acquire: 30000
  }
});

// Read all .js files from the current directory (i.e., /backend/models)
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    // For each model file found, require it and initialize it with sequelize
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Run the .associate() method for each model to create relationships
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
