const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    eventName: { type: String, required: true },
    entryFee: { type: Number, required: true },
    prizePool: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    rules: { type: String, required: true },
    image: { type: String, required: true }, // Cloudinary image URL
    createdAt: { type: Date, default: Date.now }, // Store system time when created
  },
  { timestamps: true } // Automatically adds createdAt and updatedAt fields
);

const Event = mongoose.model("Event", EventSchema);
module.exports = Event;
