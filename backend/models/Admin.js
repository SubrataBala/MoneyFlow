const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true, validate: { notEmpty: true } },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), defaultValue: 'admin' }
  }, {
    tableName: 'admins',
    hooks: {
      beforeCreate: async (admin) => {
        if (admin.password) admin.password = await bcrypt.hash(admin.password, 12);
      },
      beforeUpdate: async (admin) => {
        if (admin.changed('password')) admin.password = await bcrypt.hash(admin.password, 12);
      }
    }
  });

  Admin.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  return Admin;
};
