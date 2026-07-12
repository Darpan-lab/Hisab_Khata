const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a category name'],
    trim: true
  },
  color: {
    type: String,
    default: '#6366f1' // Default indigo hex color
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: false
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Avoid duplicate category names for the same user/group combination
CategorySchema.index({ name: 1, user: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
