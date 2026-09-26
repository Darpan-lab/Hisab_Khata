const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please add a username'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6
  },
  sheetUrl: {
    type: String,
    default: ''
  },
  telegramChatId: {
    type: String,
    default: null
  },
  activeTelegramGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    default: null
  },
  profilePic: {
    type: String,
    default: ''
  },
  budget: {
    type: Number,
    default: 0
  },
  historicalBudgets: [
    {
      year: { type: Number, required: true },
      month: { type: Number, required: true },
      amount: { type: Number, required: true }
    }
  ],
  linkedPersonalGroups: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group'
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
