const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Admin, Owner } = require('../models');

const generateToken = (user) => {
  const payload = {
    id: user.id,
    role: user.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

exports.login = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: 'All fields required' });

    if (role !== 'admin' && role !== 'owner') {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    // Select the correct model based on the provided role.
    const Model = role === 'admin' ? Admin : Owner;
    const user = await Model.findOne({ where: { username } });

    // If the user doesn't exist for the selected role, check if they exist under the other role
    // to provide a more helpful error message to the user.
    if (!user) {
      const OtherModel = role === 'admin' ? Owner : Admin;
      const otherUser = await OtherModel.findOne({ where: { username } });
      if (otherUser) {
        return res.status(401).json({ message: `User found, but wrong role selected. Try logging in as '${otherUser.role}'.` });
      }
      return res.status(401).json({ message: `No account found for username '${username}'.` });
    }

    // Both Admin and Owner models have a `comparePassword` method to securely check the password.
    const isMatch = await user.comparePassword(password);

    // Provide a specific error for an incorrect password.
    if (!isMatch) return res.status(401).json({ message: 'The password you entered is incorrect. Please try again.' });

    if (role === 'owner' && !user.activeStatus) return res.status(403).json({ message: 'Account is deactivated' });

    // The user object from the database might not consistently have the 'role'
    // property. We already validated the 'role' from the request body, so we'll
    // attach it to the user object to ensure it's correctly included in the JWT,
    // making authentication checks reliable.
    user.role = role;

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, name: user.name || user.username }
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const { id, role } = req.user; // Role and ID from the JWT token
    let user;

    if (role === 'admin') {
      user = await Admin.findByPk(id, { attributes: { exclude: ['password'] } });
    } else if (role === 'owner') {
      user = await Owner.findByPk(id, { attributes: { exclude: ['password'] } });
    } else {
      return res.status(400).json({ message: 'Invalid role in token' });
    }
    if (!user) return res.status(404).json({ message: 'User not found' });

    const userPayload = user.get({ plain: true });
    userPayload.role = role; // Ensure the role from the token is the source of truth
    res.json(userPayload);
  } catch (err) {
    next(err);
  }
};
