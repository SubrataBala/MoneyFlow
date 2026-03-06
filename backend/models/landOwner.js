'use strict';
module.exports = (sequelize, DataTypes) => {
  const LandOwner = sequelize.define('LandOwner', {
    name: { type: DataTypes.STRING, allowNull: false },
    village: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    notes: { type: DataTypes.TEXT }
  }, { tableName: 'land_owners', underscored: true });

  LandOwner.associate = (models) => {
    LandOwner.hasMany(models.LandRecord, { foreignKey: 'landOwnerId', onDelete: 'CASCADE' });
    LandOwner.hasMany(models.LandPayment, { foreignKey: 'landOwnerId', onDelete: 'CASCADE' });
    LandOwner.belongsTo(models.Owner, { as: 'user', foreignKey: { name: 'ownerId', allowNull: false }, onDelete: 'CASCADE' });
  };

  return LandOwner;
};