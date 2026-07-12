const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a group name'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  inviteCode: {
    type: String,
    required: true,
    unique: true
  },
  sheetUrl: {
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Group', GroupSchema);
