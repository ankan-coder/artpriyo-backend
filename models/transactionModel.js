const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  transactionID: { type: String, required: true },
  title: { type: String, required: true },
  time: { type: Date, default: Date.now },
  type: { type: String, required: true },
  amount: { type: Number, required: true },
  userID: { type: String, ref: "User", required: true }, // Change userId -> userID (to match user schema)
});

module.exports = mongoose.model("Transaction", transactionSchema);
