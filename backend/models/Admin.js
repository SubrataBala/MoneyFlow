const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING(255), allowNull: false, unique: true, validate: { notEmpty: true } },
    password: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), defaultValue: 'admin' },
    email: { type: DataTypes.STRING(255), allowNull: true, unique: true, validate: { isEmail: true } },
    supabaseId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    }
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

  Admin.associate = (models) => {
    // An Admin can have many Owners that they created
    Admin.hasMany(models.Owner, { foreignKey: 'adminId', as: 'owners' });
  };

  Admin.prototype.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  };

  return Admin;
};
