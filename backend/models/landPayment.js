'use strict';
module.exports = (sequelize, DataTypes) => {
  const LandPayment = sequelize.define('LandPayment', {
    date: { type: DataTypes.DATEONLY, allowNull: false },
    amountPaid: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'amount_paid' },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'Cash', field: 'payment_method' },
    notes: { type: DataTypes.TEXT }
  }, { tableName: 'land_payments', underscored: true });

  LandPayment.associate = (models) => {
    LandPayment.belongsTo(models.LandOwner, {
      foreignKey: { name: 'landOwnerId', field: 'land_owner_id' },
      as: 'owner'
    });
  };

  return LandPayment;
};