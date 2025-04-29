const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  commentID: { type: String, required: true }, // Unique ID for the comment
  postID: { type: String, required: true }, // ID of the post this comment belongs to
  userID: { type: String, required: true }, // ID of the user who made the comment
  text: { type: String, required: true }, // Comment text
  createdAt: { type: Date, default: Date.now }, // When the comment was created
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment; 