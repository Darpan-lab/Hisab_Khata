const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
  isSignupPaused: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
