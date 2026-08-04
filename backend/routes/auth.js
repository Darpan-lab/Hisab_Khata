const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Group = require('../models/Group');
const SystemConfig = require('../models/SystemConfig');
const { protect } = require('../middleware/auth');
const { getBotUsername } = require('../services/telegramBot');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Seed default categories for a new user
const seedDefaultCategories = async (userId) => {
  const defaults = [
    { name: 'Food 🍔', color: '#f59e0b' },
    { name: 'Transport 🚗', color: '#3b82f6' },
    { name: 'Shopping 🛍️', color: '#ec4899' },
    { name: 'Entertainment 🎬', color: '#8b5cf6' },
    { name: 'Bills 💳', color: '#ef4444' },
    { name: 'Health 🏥', color: '#10b981' },
    { name: 'Others 📁', color: '#6b7280' }
  ];
  
  const categories = defaults.map(cat => ({
    ...cat,
    user: userId,
    isDefault: true
  }));

  try {
    await Category.insertMany(categories);
  } catch (err) {
    console.error('Failed to seed categories:', err.message);
  }
};

// @route   POST api/auth/signup
// @desc    Register user
// @access  Public
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if registration is paused
    let config = await SystemConfig.findOne();
    if (config && config.isSignupPaused) {
      return res.status(403).json({ success: false, message: 'Sign up is temporarily paused by the administrator.' });
    }

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter all fields' });
    }

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Select a random default avatar for the new user
    const presetAvatars = ['👤', '👨‍💻', '👩‍💻', '🦁', '🦊', '🐼', '🐱', '🕶️', '👑', '⭐', '🍀', '🔥'];
    const randomAvatar = presetAvatars[Math.floor(Math.random() * presetAvatars.length)];

    // Check if it's the first registered user to assign admin role dynamically
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    // Create user
    user = new User({
      username,
      email,
      password: hashedPassword,
      profilePic: randomAvatar,
      role
    });

    await user.save();

    // Seed default categories
    await seedDefaultCategories(user._id);

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        sheetUrl: user.sheetUrl,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup,
        telegramBotUsername: getBotUsername(),
        profilePic: user.profilePic || '',
        budget: user.budget || 0,
        historicalBudgets: user.historicalBudgets || []
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error during sign up' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter all fields' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        sheetUrl: user.sheetUrl,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup,
        telegramBotUsername: getBotUsername(),
        profilePic: user.profilePic || '',
        budget: user.budget || 0,
        historicalBudgets: user.historicalBudgets || []
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// @route   GET api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        sheetUrl: user.sheetUrl,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup,
        telegramBotUsername: getBotUsername(),
        profilePic: user.profilePic || '',
        budget: user.budget || 0,
        historicalBudgets: user.historicalBudgets || []
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error retrieving profile' });
  }
});

// @route   PUT api/auth/sheeturl
// @desc    Update user's Google Apps Script Web App URL
// @access  Private
router.put('/sheeturl', protect, async (req, res) => {
  const { sheetUrl } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.sheetUrl = sheetUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Google Sheet Apps Script URL updated successfully',
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        sheetUrl: user.sheetUrl,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup,
        telegramBotUsername: getBotUsername(),
        profilePic: user.profilePic || '',
        budget: user.budget || 0,
        historicalBudgets: user.historicalBudgets || []
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error updating sheets settings' });
  }
});

// @route   PUT api/auth/profile
// @desc    Update user profile details (username, email, profilePic, password, budget)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  const { username, email, profilePic, currentPassword, newPassword, budget, telegramChatId, activeTelegramGroup } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Check if new email is already in use by another user
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already taken' });
      }
      user.email = email;
    }

    if (username) {
      user.username = username;
    }

    if (profilePic !== undefined) {
      user.profilePic = profilePic;
    }

    if (budget !== undefined) {
      user.budget = Number(budget) || 0;
    }

    if (telegramChatId !== undefined) {
      user.telegramChatId = telegramChatId ? telegramChatId.trim() : null;
    }

    if (activeTelegramGroup !== undefined) {
      user.activeTelegramGroup = activeTelegramGroup || null;
    }

    // If changing password, verify current password (unless user is an admin) and hash new password
    if (newPassword) {
      const isAdmin = (user.role && user.role.toLowerCase() === 'admin') || 
                      (user.username && user.username.toLowerCase() === 'rkdarpan');

      if (!isAdmin) {
        if (!currentPassword) {
          return res.status(400).json({ success: false, message: 'Please provide your current password to set a new password' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ success: false, message: 'Incorrect current password' });
        }
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        sheetUrl: user.sheetUrl,
        telegramChatId: user.telegramChatId,
        activeTelegramGroup: user.activeTelegramGroup,
        telegramBotUsername: getBotUsername(),
        profilePic: user.profilePic || '',
        budget: user.budget || 0,
        historicalBudgets: user.historicalBudgets || []
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
});

// @route   GET api/auth/users
// @desc    Get all registered users (Admin only)
// @access  Private
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.username !== 'rkdarpan') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin only' });
    }
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error retrieving users' });
  }
});

// @route   DELETE api/auth/users/:id
// @desc    Delete a user and all their data permanently (Admin only)
// @access  Private
router.delete('/users/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.username !== 'rkdarpan') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin only' });
    }

    const userId = req.params.id;

    // Prevent deleting the root user
    const userToDelete = await User.findById(userId);
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (userToDelete.role === 'admin' || userToDelete.username === 'rkdarpan') {
      return res.status(400).json({ success: false, message: 'Root user cannot be deleted' });
    }

    // 1. Delete user's transactions
    await Transaction.deleteMany({ user: userId });

    // 2. Delete user's custom categories
    await Category.deleteMany({ user: userId });

    // 3. Delete groups owned by this user, along with group transactions and categories
    const ownedGroups = await Group.find({ owner: userId });
    for (const group of ownedGroups) {
      await Transaction.deleteMany({ group: group._id });
      await Category.deleteMany({ group: group._id });
      await Group.deleteOne({ _id: group._id });
    }

    // 4. Remove the user from members array of other groups
    await Group.updateMany(
      { members: userId },
      { $pull: { members: userId } }
    );

    // 5. Delete the user
    await User.deleteOne({ _id: userId });

    res.json({ success: true, message: 'User and all associated data deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error deleting user' });
  }
});

// @route   GET api/auth/signup-status
// @desc    Get sign up status
// @access  Public
router.get('/signup-status', async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({ isSignupPaused: false });
    }
    res.json({ success: true, isSignupPaused: config.isSignupPaused });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error retrieving signup status' });
  }
});

// @route   PUT api/auth/toggle-signup
// @desc    Toggle signup paused state (Admin only)
// @access  Private
router.put('/toggle-signup', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.username !== 'rkdarpan') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin only' });
    }

    const { isSignupPaused } = req.body;
    if (typeof isSignupPaused !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isSignupPaused must be a boolean' });
    }

    let config = await SystemConfig.findOne();
    if (!config) {
      config = new SystemConfig({ isSignupPaused });
    } else {
      config.isSignupPaused = isSignupPaused;
    }
    await config.save();

    res.json({ success: true, isSignupPaused: config.isSignupPaused, message: `Sign up is now ${config.isSignupPaused ? 'paused' : 'active'}` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error toggling signup' });
  }
});

// @route   PUT api/auth/users/:id/password
// @desc    Set new password for another user (Admin only)
// @access  Private
router.put('/users/:id/password', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.username !== 'rkdarpan') {
      return res.status(403).json({ success: false, message: 'Access denied: Admin only' });
    }

    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    const userToUpdate = await User.findById(req.params.id);
    if (!userToUpdate) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    userToUpdate.password = await bcrypt.hash(password, salt);
    await userToUpdate.save();

    res.json({ success: true, message: `Password for ${userToUpdate.username} updated successfully` });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error setting user password' });
  }
});

module.exports = router;
