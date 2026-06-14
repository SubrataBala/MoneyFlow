const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const axios = require('axios');
const { Op } = require('sequelize');

const { Admin, Owner } = require('../models');

const isOwnerInactive = (activeStatus) => (
  activeStatus === false || activeStatus === 'false' || activeStatus === 0 || activeStatus === '0'
);

const generateToken = (user) => {
  const payload = {
    id: user.id,
    role: user.role,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};

const getSupabaseAdminUser = async (accessToken) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const err = new Error('Supabase is not configured on the server.');
    err.statusCode = 500;
    throw err;
  }

  const { data } = await axios.get(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!data?.id || !data?.email) {
    const err = new Error('Google account did not return a verified email.');
    err.statusCode = 401;
    throw err;
  }

  return data;
};

exports.login = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: 'All fields required' });

    if (role !== 'admin' && role !== 'owner') {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    if (role === 'admin') {
      return res.status(400).json({ message: 'Admins must continue with Gmail.' });
    }

    // Select the correct model based on the provided role.
    const Model = Owner;
    const user = await Model.findOne({ where: { username } });

    // If the user doesn't exist for the selected role, check if they exist under the other role
    // to provide a more helpful error message to the user.
    if (!user) {
      const OtherModel = Admin;
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

    if (role === 'owner' && isOwnerInactive(user.activeStatus)) return res.status(403).json({ message: 'Account is deactivated' });

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

exports.loginAdminWithSupabase = async (req, res, next) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ message: 'Supabase access token is required' });

    const supabaseUser = await getSupabaseAdminUser(accessToken);
    const email = String(supabaseUser.email).toLowerCase();
    if (!email.endsWith('@gmail.com')) {
      return res.status(403).json({ message: 'Admin login is Gmail only.' });
    }
    const name = supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || email.split('@')[0];

    let admin = await Admin.findOne({
      where: {
        [Op.or]: [
          { supabaseId: supabaseUser.id },
          { email: email },
          { username: email }
        ]
      }
    });

    if (!admin) {
      admin = await Admin.create({
        username: email,
        email,
        supabaseId: supabaseUser.id,
        name,
        password: crypto.randomBytes(32).toString('hex'),
        role: 'admin'
      });
    } else {
      const updates = {};
      if (!admin.email) updates.email = email;
      if (!admin.supabaseId) updates.supabaseId = supabaseUser.id;
      if (!admin.name && name) updates.name = name;
      if (Object.keys(updates).length > 0) {
        await admin.update(updates);
      }
    }

    admin.role = 'admin';
    const token = generateToken(admin);
    res.json({
      token,
      user: { id: admin.id, username: admin.username, email: admin.email || email, role: 'admin', name: admin.name || name }
    });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      return res.status(401).json({ message: 'Google login verification failed. Please try again.' });
    }
    next(err);
  }
};

exports.registerAdmin = async (req, res, next) => {
  try {
    return res.status(400).json({ message: 'Admin registration now uses Continue with Gmail.' });
  } catch (err) {
    // Pass errors to the global error handler
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
