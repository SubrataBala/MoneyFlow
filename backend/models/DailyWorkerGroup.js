'use strict';
module.exports = (sequelize, DataTypes) => {
  const DailyWorkerGroup = sequelize.define('DailyWorkerGroup', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'owners', key: 'id' },
      onDelete: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    defaultDailyRate: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 400
    }
  }, {
    tableName: 'daily_worker_groups'
  });

  DailyWorkerGroup.associate = (models) => {
    DailyWorkerGroup.belongsTo(models.Owner, { foreignKey: 'ownerId', as: 'owner' });
  };

  return DailyWorkerGroup;
};
