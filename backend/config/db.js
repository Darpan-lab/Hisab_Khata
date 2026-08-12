const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    const isAtlas = process.env.MONGODB_URI?.includes('mongodb+srv://');
    console.log(`MongoDB Connected: ${conn.connection.host} (${isAtlas ? 'Atlas Cloud' : 'Local/Direct'})`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    if (process.env.MONGODB_URI?.includes('mongodb+srv://')) {
      console.error('💡 Atlas Connection Tip: Check Network Access (IP whitelist 0.0.0.0/0) and DB credentials in backend/.env');
    }
    process.exit(1);
  }
};

module.exports = connectDB;
