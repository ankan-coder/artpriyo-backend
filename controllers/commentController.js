const Comment = require("../models/commentModel");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Add a comment to a post
const addComment = async (req, res) => {
  try {
    const { postID } = req.params;
    const { text } = req.body;
    const userID = req.user.userID;

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Comment text is required",
      });
    }

    let post;
    
    // Try to find post by postID first
    post = await Post.findOne({ postID });
    
    // If not found, check if postID is a valid MongoDB ID and try to find by _id
    if (!post && mongoose.Types.ObjectId.isValid(postID)) {
      post = await Post.findById(postID);
    }
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const newComment = new Comment({
      commentID: uuidv4(),
      postID: post.postID,
      userID,
      text,
    });

    await newComment.save();

    // Increment the comments count on the post
    post.commentsCount = (post.commentsCount || 0) + 1;
    await post.save();

    // Get user details for the response
    const user = await User.findById(userID);

    const commentWithUser = {
      _id: newComment._id,
      commentID: newComment.commentID,
      text: newComment.text,
      createdAt: newComment.createdAt,
      user: {
        _id: user._id,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        userName: user.userName || "",
        image: user.image || "",
      }
    };

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: commentWithUser,
    });
  } catch (error) {
    console.error("Comment Creation Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while adding comment",
      error: error.message,
    });
  }
};

// Get comments for a post
const getComments = async (req, res) => {
  try {
    const { postID } = req.params;
    
    let post;
    let commentsQuery;
    
    // Try to find post by postID first
    post = await Post.findOne({ postID });
    
    // If not found, check if postID is a valid MongoDB ID and try to find by _id
    if (!post && mongoose.Types.ObjectId.isValid(postID)) {
      post = await Post.findById(postID);
      // If post exists and was found by _id, use the postID for query
      if (post) {
        commentsQuery = { postID: post.postID };
      }
    } else if (post) {
      // Post found by postID
      commentsQuery = { postID };
    }
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Get comments sorted by creation date (newest first)
    const comments = await Comment.find(commentsQuery).sort({ createdAt: -1 });

    // Get user details for each comment
    const commentsWithUserDetails = await Promise.all(
      comments.map(async (comment) => {
        const user = await User.findById(comment.userID);
        
        return {
          _id: comment._id,
          commentID: comment.commentID,
          text: comment.text,
          createdAt: comment.createdAt,
          user: {
            _id: user._id,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            userName: user.userName || "",
            image: user.image || "",
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      comments: commentsWithUserDetails,
    });
  } catch (error) {
    console.error("Error Fetching Comments:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching comments",
      error: error.message,
    });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const { commentID } = req.params;
    const userID = req.user.userID;

    // Find the comment
    const comment = await Comment.findOne({ 
      $or: [
        { commentID },
        ...(mongoose.Types.ObjectId.isValid(commentID) ? [{ _id: commentID }] : [])
      ]
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    // Check if the user is the owner of the comment
    if (comment.userID !== userID) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this comment",
      });
    }

    // Find the post and decrement the comments count
    let post;
    
    // Try to find post by postID first
    post = await Post.findOne({ postID: comment.postID });
    
    if (post) {
      post.commentsCount = Math.max(0, (post.commentsCount || 0) - 1);
      await post.save();
    }

    // Delete the comment
    await Comment.deleteOne({ _id: comment._id });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error Deleting Comment:", error);
    res.status(500).json({
      success: false,
      message: "Error while deleting comment",
      error: error.message,
    });
  }
};

module.exports = {
  addComment,
  getComments,
  deleteComment,
}; 