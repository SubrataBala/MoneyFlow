module.exports = (sequelize, DataTypes) => {
  const FertilizerShopkeeper = sequelize.define('FertilizerShopkeeper', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING,
    },
    address: {
      type: DataTypes.STRING,
    },
  });

  FertilizerShopkeeper.associate = (models) => {
    FertilizerShopkeeper.belongsTo(models.Owner, { as: 'owner', foreignKey: { name: 'ownerId', allowNull: false }, onDelete: 'CASCADE' });
  };

  return FertilizerShopkeeper;
};