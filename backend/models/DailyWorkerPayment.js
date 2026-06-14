module.exports = (sequelize, DataTypes) => {
  const DailyWorkerPayment = sequelize.define('DailyWorkerPayment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'owners', key: 'id' },
      onDelete: 'CASCADE'
    },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    paymentDate: { type: DataTypes.DATEONLY, allowNull: false },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    notes: { type: DataTypes.TEXT },
    paymentMethod: { type: DataTypes.STRING, defaultValue: 'Cash' }
  }, {
    tableName: 'daily_worker_payments'
  });

  DailyWorkerPayment.associate = (models) => {
    DailyWorkerPayment.belongsTo(models.Owner, { foreignKey: 'ownerId', as: 'owner' });
  };

  return DailyWorkerPayment;
};
