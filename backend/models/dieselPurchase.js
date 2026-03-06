'use strict';
module.exports = (sequelize, DataTypes) => {
  const DieselPurchase = sequelize.define('DieselPurchase', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    slip_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    notes: DataTypes.TEXT,
  }, {});
  DieselPurchase.associate = function(models) {
    // This purchase belongs to a user
    DieselPurchase.belongsTo(models.Owner); // Adds OwnerId column
    // This purchase is associated with a specific pump
    DieselPurchase.belongsTo(models.DieselPump, { foreignKey: 'petrol_pump_id' });
  };
  return DieselPurchase;
};