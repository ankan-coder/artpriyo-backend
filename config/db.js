const mongoose = require("mongoose");
const colors = require("colors");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("MongoDB Connected...".green);
  } catch (error) {
    console.log(colors.red("Error in DB Connection: " + error.message));
  }
};

module.exports = connectDB;
