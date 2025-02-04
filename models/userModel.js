const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "Please add First Name"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Please add Last Name"],
      trim: true,
    },
    userName: {
      type: String,
      required: [true, "Please add User Name"],
      trim: true,
      unique: true,
    },
    accountType: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
    },
    email: {
      type: String,
      required: [true, "Please add Email"],
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Please add Password"],
      trim: true,
      select: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
