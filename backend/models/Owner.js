const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Owner = sequelize.define('Owner', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), defaultValue: 'owner' },
    activeStatus: { type: DataTypes.BOOLEAN, defaultValue: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admins', // This is the table name for the Admin model
        key: 'id'
      }
    }
  }, {
    tableName: 'owners',
    hooks: {
      beforeCreate: async (owner) => {
        if (owner.password) owner.password = await bcrypt.hash(owner.password, 12);
      },
      beforeUpdate: async (owner) => {
        if (owner.changed('password')) owner.password = await bcrypt.hash(owner.password, 12);
      },
    }
  });

  Owner.associate = (models) => {
    // An Owner belongs to an Admin
    Owner.belongsTo(models.Admin, { foreignKey: 'adminId', as: 'admin' });

    Owner.hasMany(models.Labour, { foreignKey: 'ownerId', as: 'labours' });
    Owner.hasMany(models.DailyWorkerSummary, { foreignKey: 'ownerId', as: 'dailySummaries' });
    Owner.hasMany(models.FertilizerShopkeeper, { as: 'fertilizerShopkeepers', foreignKey: 'ownerId' });
    Owner.hasMany(models.FertilizerPurchase, { as: 'fertilizerPurchases', foreignKey: 'ownerId' });
    Owner.hasMany(models.FertilizerPayment, { as: 'fertilizerPayments', foreignKey: 'ownerId' });
    Owner.hasMany(models.LandOwner, { as: 'landOwners', foreignKey: 'ownerId' });
    Owner.hasMany(models.DailyWorkerPayment, { foreignKey: 'ownerId', as: 'dailyWorkerPayments' });

    // Associations for Diesel Management
    Owner.hasMany(models.DieselPump, { as: 'dieselPumps', foreignKey: 'OwnerId' });
    Owner.hasMany(models.DieselPurchase, { as: 'dieselPurchases', foreignKey: 'OwnerId' });
    Owner.hasMany(models.DieselPayment, { as: 'dieselPayments', foreignKey: 'OwnerId' });
    Owner.hasMany(models.LabourPayment, { foreignKey: 'ownerId', as: 'labourPayments' });
  };

  Owner.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  return Owner;
};
