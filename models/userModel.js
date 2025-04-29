const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    userID: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
    },
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
      select: true,
    },
    description: {
      type: String,
      required: false,
    },
    balance: {
      type: Number,
      required: false,
      default: 0,
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    followingCount: {
      type: Number,
      default: 0,
    },
    events: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
