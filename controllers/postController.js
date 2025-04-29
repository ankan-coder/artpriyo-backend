const Post = require("../models/postModel");
const User = require("../models/userModel");
const JWT = require("jsonwebtoken");
const mongoose = require("mongoose");

// Toggle like on a post
const toggleLike = async (req, res) => {
  try {
    const { postID } = req.params;
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
    
    // Check if user has already liked the post
    const userHasLiked = post.likedBy && post.likedBy.includes(req.user.userID);
    
    if (userHasLiked) {
      // Unlike: Remove user from likedBy array and decrement likes count
      post.likedBy = post.likedBy.filter(id => id !== req.user.userID);
      post.likes = Math.max(0, post.likes - 1); // Ensure likes don't go below 0
    } else {
      // Like: Add user to likedBy array and increment likes count
      if (!post.likedBy) {
        post.likedBy = [];
      }
      post.likedBy.push(req.user.userID);
      post.likes += 1;
    }
    
    await post.save();
    
    res.status(200).json({
      success: true,
      message: userHasLiked ? "Post unliked successfully" : "Post liked successfully",
      likes: post.likes,
      userHasLiked: !userHasLiked,
    });
  } catch (error) {
    console.error("Like Toggle Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while toggling like",
      error: error.message,
    });
  }
};

// Get like status for a post
const getLikeStatus = async (req, res) => {
  try {
    const { postID } = req.params;
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
    
    // Check if user has liked the post
    const userHasLiked = post.likedBy && post.likedBy.includes(req.user.userID);
    
    res.status(200).json({
      success: true,
      likes: post.likes,
      userHasLiked,
    });
  } catch (error) {
    console.error("Like Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while checking like status",
      error: error.message,
    });
  }
};

// Get trending posts (sorted by most likes)
const getTrendingPosts = async (req, res) => {
  try {
    // Get the current date and date 24 hours ago
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // First get brand new posts (from the last 24 hours)
    const brandNewPosts = await Post.find({
      createdAt: { $gte: yesterday }
    }).sort({ createdAt: -1 }).limit(5);
    
    // Then get trending posts by likes
    // Exclude posts that are already in brandNewPosts
    const brandNewPostIds = brandNewPosts.map(post => post._id.toString());
    
    const trendingPosts = await Post.find({
      _id: { $nin: brandNewPostIds }
    }).sort({ likes: -1 }).limit(10 - brandNewPosts.length);
    
    // Combine the posts, with brand new ones first
    const combinedPosts = [...brandNewPosts, ...trendingPosts];
    
    // Check if request has authorization header (optional auth)
    const authHeader = req.headers.authorization;
    let userID = null;
    
    if (authHeader) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = JWT.verify(token, process.env.JWT_SECRET);
        userID = decoded._id;
      } catch (err) {
        // Invalid token - proceed without user context
        console.log("Invalid token in trending-posts, proceeding without user context");
      }
    }

    const postsWithUserDetails = await Promise.all(
      combinedPosts.map(async (post) => {
        const user = await User.findById(post.userID);
        
        // Convert post to plain object to allow adding custom properties
        const postObj = post.toObject();
        
        // Add user data
        postObj.user = user;
        
        // Add userHasLiked flag if user is authenticated
        if (userID) {
          postObj.userHasLiked = post.likedBy && post.likedBy.includes(userID);
        }
        
        // Ensure the _id field is included (for frontend compatibility)
        postObj._id = postObj._id || post._id;
        
        // For frontend compatibility (frontend expects likes to be an array)
        // We'll include both the numeric likes count and the likedBy array
        postObj.likesCount = post.likes;
        postObj.likes = post.likedBy || [];
        
        // Include comments count
        postObj.commentsCount = post.commentsCount || 0;
        
        // Add a flag to indicate if this is a brand new post
        postObj.isBrandNew = new Date(post.createdAt) >= yesterday;

        return postObj;
      })
    );

    res.status(200).json({ 
      success: true, 
      posts: postsWithUserDetails,
    });
  } catch (error) {
    console.error("Error fetching trending posts:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching trending posts",
      error: error.message,
    });
  }
};

// Save a post
const savePost = async (req, res) => {
  try {
    const { postID } = req.params;
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
    
    // Check if user has already saved the post
    if (post.savedBy && post.savedBy.includes(req.user.userID)) {
      return res.status(400).json({
        success: false,
        message: "Post already saved",
      });
    }
    
    // Add user to savedBy array
    if (!post.savedBy) {
      post.savedBy = [];
    }
    post.savedBy.push(req.user.userID);
    
    await post.save();
    
    res.status(200).json({
      success: true,
      message: "Post saved successfully",
    });
  } catch (error) {
    console.error("Save Post Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while saving post",
      error: error.message,
    });
  }
};

// Unsave a post
const unsavePost = async (req, res) => {
  try {
    const { postID } = req.params;
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
    
    // Check if user has saved the post
    if (!post.savedBy || !post.savedBy.includes(req.user.userID)) {
      return res.status(400).json({
        success: false,
        message: "Post not saved",
      });
    }
    
    // Remove user from savedBy array
    post.savedBy = post.savedBy.filter(id => id !== req.user.userID);
    
    await post.save();
    
    res.status(200).json({
      success: true,
      message: "Post unsaved successfully",
    });
  } catch (error) {
    console.error("Unsave Post Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while unsaving post",
      error: error.message,
    });
  }
};

// Check if a post is saved by the current user
const checkSavedStatus = async (req, res) => {
  try {
    const { postID } = req.params;
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
    
    // Check if user has saved the post
    const isSaved = post.savedBy && post.savedBy.includes(req.user.userID);
    
    res.status(200).json({
      success: true,
      isSaved,
    });
  } catch (error) {
    console.error("Check Saved Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while checking saved status",
      error: error.message,
    });
  }
};

// Get saved posts for the current user
const getSavedPosts = async (req, res) => {
  try {
    // Find all posts that have the current user in their savedBy array
    const posts = await Post.find({
      savedBy: { $in: [req.user.userID] }
    }).sort({ createdAt: -1 });

    // Get user details for each post
    const postsWithUserDetails = await Promise.all(
      posts.map(async (post) => {
        const user = await User.findById(post.userID);
        
        // Convert post to plain object to allow adding custom properties
        const postObj = post.toObject();
        
        // Add user data
        postObj.user = user;
        
        // Add userHasLiked flag
        postObj.userHasLiked = post.likedBy && post.likedBy.includes(req.user.userID);
        
        // Ensure the _id field is included (for frontend compatibility)
        postObj._id = postObj._id || post._id;
        
        // For frontend compatibility (frontend expects likes to be an array)
        postObj.likesCount = post.likes;
        postObj.likes = post.likedBy || [];
        
        // Include comments count
        postObj.commentsCount = post.commentsCount || 0;

        return postObj;
      })
    );

    res.status(200).json({
      success: true,
      posts: postsWithUserDetails,
    });
  } catch (error) {
    console.error("Error fetching saved posts:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching saved posts",
      error: error.message,
    });
  }
};

// Get posts made by the current user
const getUserPosts = async (req, res) => {
  try {
    const currentUser = req.user._id;
    console.log('Fetching posts for user:', currentUser);

    // Find all posts created by the current user
    const posts = await Post.find({ userID: currentUser })
      .sort({ createdAt: -1 });
    
    console.log('Found posts:', posts);

    // Format posts with user data and like status
    const formattedPosts = await Promise.all(posts.map(async (post) => {
      const postObj = post.toObject();
      const user = await User.findById(post.userID);
      
      return {
        ...postObj,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          userName: user.userName,
          image: user.image,
        },
        userHasLiked: post.likedBy.includes(currentUser),
        likesCount: post.likes,
        commentsCount: post.commentsCount,
      };
    }));

    console.log('Formatted posts:', formattedPosts);

    res.status(200).json({
      success: true,
      posts: formattedPosts,
    });
  } catch (error) {
    console.error('Error in getUserPosts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user posts',
      error: error.message
    });
  }
};

const updatePost = async (req, res) => {
  try {
    const { postID } = req.params;
    const { caption } = req.body;
    const currentUser = req.user._id;

    // Find the post
    let post = await Post.findOne({ postID });
    
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

    // Check if the current user is the owner of the post
    if (post.userID !== currentUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to edit this post",
      });
    }

    // Update the caption
    post.caption = caption;
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post updated successfully",
      post: {
        _id: post._id,
        caption: post.caption,
        media: post.media,
        userID: post.userID,
        createdAt: post.createdAt,
      },
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      success: false,
      message: "Error while updating post",
      error: error.message,
    });
  }
};

const deletePost = async (req, res) => {
  try {
    const { postID } = req.params;
    const currentUser = req.user._id;

    // Find the post
    let post = await Post.findOne({ postID });
    
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

    // Check if the current user is the owner of the post
    if (post.userID !== currentUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this post",
      });
    }

    // Delete the post
    await Post.deleteOne({ _id: post._id });

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      success: false,
      message: "Error while deleting post",
      error: error.message,
    });
  }
};

module.exports = {
  toggleLike,
  getLikeStatus,
  getTrendingPosts,
  savePost,
  unsavePost,
  checkSavedStatus,
  getSavedPosts,
  getUserPosts,
  updatePost,
  deletePost,
}; 