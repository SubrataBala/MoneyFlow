module.exports = (sequelize, DataTypes) => {
  const FertilizerPayment = sequelize.define('FertilizerPayment', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    amount_paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
    },
  });

  FertilizerPayment.associate = (models) => {
    FertilizerPayment.belongsTo(models.Owner, { as: 'owner', foreignKey: { name: 'ownerId', allowNull: false }, onDelete: 'CASCADE' });
    FertilizerPayment.belongsTo(models.FertilizerShopkeeper, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
  };

  return FertilizerPayment;
};