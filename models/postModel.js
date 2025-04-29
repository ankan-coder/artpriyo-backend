const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  postID: { type: String, required: true },
  eventID: { type: String, ref: "Event", required: false },
  likes: { type: Number, required: true, default: 0 },
  likedBy: { type: [String], default: [] }, // Array of userIDs who liked the post
  savedBy: { type: [String], default: [] }, // Array of userIDs who saved the post
  commentsCount: { type: Number, default: 0 }, // Count of comments on this post
  caption: { type: String, required: false },
  media: { type: [String], required: true },
  userID: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
