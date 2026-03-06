module.exports = (sequelize, DataTypes) => {
  const FertilizerPurchase = sequelize.define('FertilizerPurchase', {
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
    },
    slip_filename: {
      type: DataTypes.STRING,
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  });

  FertilizerPurchase.associate = (models) => {
    FertilizerPurchase.belongsTo(models.Owner, { as: 'owner', foreignKey: { name: 'ownerId', allowNull: false }, onDelete: 'CASCADE' });
    FertilizerPurchase.belongsTo(models.FertilizerShopkeeper, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
    FertilizerPurchase.hasMany(models.FertilizerPurchaseItem, { as: 'items', onDelete: 'CASCADE' });
  };

  return FertilizerPurchase;
};