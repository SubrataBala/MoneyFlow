module.exports = (sequelize, DataTypes) => {
  const DailyWorkerSummary = sequelize.define('DailyWorkerSummary', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'owners', key: 'id' } },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    totalWorkers: { type: DataTypes.INTEGER, defaultValue: 0 },
    dailyAmount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    totalWage: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    totalPaid: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    remaining: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
  }, {
    tableName: 'daily_worker_summary',
    indexes: [
      { unique: true, fields: ['ownerId', 'date'] },
      { fields: ['date'] }
    ]
  });

  DailyWorkerSummary.associate = (models) => {
    DailyWorkerSummary.belongsTo(models.Owner, { foreignKey: 'ownerId', as: 'owner' });
  };

  return DailyWorkerSummary;
};
