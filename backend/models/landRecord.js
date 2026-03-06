'use strict';
module.exports = (sequelize, DataTypes) => {
  const LandRecord = sequelize.define('LandRecord', {
    landMeasurement: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'land_measurement' },
    convertedUnits: { type: DataTypes.INTEGER, allowNull: false, field: 'converted_units' },
    pricePerUnit: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'price_per_unit' },
    totalAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'total_amount' },
    notes: { type: DataTypes.TEXT }
  }, { tableName: 'land_records', underscored: true });

  LandRecord.associate = (models) => {
    LandRecord.belongsTo(models.LandOwner, {
      foreignKey: { name: 'landOwnerId', field: 'land_owner_id' },
      as: 'owner'
    });
  };

  return LandRecord;
};