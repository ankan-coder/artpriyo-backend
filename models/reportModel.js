const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportID: { type: String, required: true }, // Unique ID for the report
  postID: { type: String, required: true }, // ID of the post being reported
  userID: { type: String, required: true }, // ID of the user making the report
  reason: { type: String, required: true }, // Reason for the report
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending'
  }, // Status of the report
  createdAt: { type: Date, default: Date.now }, // When the report was made
  updatedAt: { type: Date, default: Date.now } // When the report was last updated
});

const Report = mongoose.model("Report", reportSchema);

module.exports = Report; 