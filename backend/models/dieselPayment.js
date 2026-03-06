'use strict';
module.exports = (sequelize, DataTypes) => {
  const DieselPayment = sequelize.define('DieselPayment', {
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Cash',
    },
    notes: DataTypes.TEXT,
  }, {});
  DieselPayment.associate = function(models) {
    // This payment belongs to a user
    DieselPayment.belongsTo(models.Owner); // Adds OwnerId column
    // This payment is associated with a specific pump
    DieselPayment.belongsTo(models.DieselPump, { foreignKey: 'petrol_pump_id' });
  };
  return DieselPayment;
};