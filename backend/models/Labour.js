module.exports = (sequelize, DataTypes) => {
  const Labour = sequelize.define('Labour', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    ownerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'owners', key: 'id' } },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, { tableName: 'labours' });

  Labour.associate = (models) => {
    Labour.belongsTo(models.Owner, { foreignKey: 'ownerId', as: 'owner' });
    Labour.hasMany(models.Attendance, { foreignKey: 'labourId', as: 'attendances' });
  };

  return Labour;
};
