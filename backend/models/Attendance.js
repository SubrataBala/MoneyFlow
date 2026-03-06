module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    labourId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'labours', key: 'id' } },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    attendance: { type: DataTypes.ENUM('present', 'absent'), defaultValue: 'absent' },
    dailyWage: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
    amountPaidToday: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }
  }, {
    tableName: 'attendance',
    indexes: [
      { unique: true, fields: ['labourId', 'date'] },
      { fields: ['date'] }
    ]
  });

  Attendance.associate = (models) => {
    Attendance.belongsTo(models.Labour, { foreignKey: 'labourId', as: 'labour' });
  };

  return Attendance;
};
