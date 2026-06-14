module.exports = (sequelize, DataTypes) => {
  const LabourPayment = sequelize.define('LabourPayment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    notes: { type: DataTypes.TEXT },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'Cash' },
    labourId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'labours', key: 'id' },
      onDelete: 'CASCADE'
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'owners', key: 'id' },
      onDelete: 'CASCADE'
    }
  }, {
    tableName: 'labour_payments',
    underscored: true
  });

  LabourPayment.associate = (models) => {
    LabourPayment.belongsTo(models.Labour, { foreignKey: 'labourId' });
    LabourPayment.belongsTo(models.Owner, { foreignKey: 'ownerId' });
  };

  return LabourPayment;
};