module.exports = (sequelize, DataTypes) => {
  const FertilizerPurchaseItem = sequelize.define('FertilizerPurchaseItem', {
    item_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    rate: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  });

  FertilizerPurchaseItem.associate = (models) => {
    FertilizerPurchaseItem.belongsTo(models.FertilizerPurchase, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
  };

  return FertilizerPurchaseItem;
};