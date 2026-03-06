'use strict';
module.exports = (sequelize, DataTypes) => {
  const DieselPump = sequelize.define('DieselPump', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    owner_name: DataTypes.STRING,
    contact_number: DataTypes.STRING,
    address: DataTypes.TEXT,
  }, {});
  DieselPump.associate = function(models) {
    // This pump belongs to a user
    DieselPump.belongsTo(models.Owner); // Adds OwnerId column
    // If a pump is deleted, also delete all its purchases and payments
    DieselPump.hasMany(models.DieselPurchase, { foreignKey: 'petrol_pump_id', onDelete: 'CASCADE', hooks: true });
    DieselPump.hasMany(models.DieselPayment, { foreignKey: 'petrol_pump_id', onDelete: 'CASCADE', hooks: true });
  };
  return DieselPump;
};