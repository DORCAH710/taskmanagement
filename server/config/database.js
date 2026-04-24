const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database: ${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    
    // Fallback to local if Atlas fails
    try {
      const localConn = await mongoose.connect('mongodb://localhost:27017/task-management');
      console.log('Connected to local MongoDB as fallback');
    } catch (localError) {
      console.error('Local MongoDB also failed:', localError.message);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
