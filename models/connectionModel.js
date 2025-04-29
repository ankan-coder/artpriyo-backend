const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending"
    },
    requestedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Compound index to ensure uniqueness of connections
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

module.exports = mongoose.model("Connection", connectionSchema); 