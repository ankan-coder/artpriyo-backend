const express = require("express");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const authMiddleware = require("../helpers/authMiddleware");
const adminMiddleware = require("../helpers/adminMiddleware");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const FormData = require("form-data");
const JWT = require("jsonwebtoken");

const {
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
} = require("../controllers/postController");
const {
  addComment,
  getComments,
  deleteComment,
} = require("../controllers/commentController");
const {
  submitReport,
  getAllReports,
  updateReportStatus,
} = require("../controllers/reportController");

const router = express.Router();

const uploadToCloudinary = async (mediaUri) => {
  try {
    const formData = new FormData();

    // Check if the file is a video
    const isVideo =
      mediaUri.startsWith("data:video") ||
      mediaUri.endsWith(".mp4") ||
      mediaUri.endsWith(".mov");

    // Validate media format
    if (
      !mediaUri.startsWith("data:image") &&
      !mediaUri.startsWith("data:video") &&
      !mediaUri.startsWith("http")
    ) {
      throw new Error(
        "Invalid media format. Must be a base64 string or a URL."
      );
    }

    // Additional validation for image formats
    if (
      mediaUri.startsWith("data:image") &&
      !mediaUri.match(/^data:image\/(jpeg|jpg|png|gif);base64,/)
    ) {
      throw new Error(
        "Invalid image file. Supported formats are JPEG, PNG, and GIF."
      );
    }

    formData.append("file", mediaUri);
    formData.append("upload_preset", "artpriyo"); // Your Cloudinary preset
    formData.append("resource_type", isVideo ? "video" : "image"); // Set correct resource type

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/dbueqvycn/${
      isVideo ? "video" : "image"
    }/upload`;

    console.log(JSON.stringify(formData));

    const response = await axios.post(cloudinaryUrl, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...formData.getHeaders(),
      },
    });

    return response.data.secure_url; // Return the uploaded media URL
  } catch (error) {
    console.error(
      "Cloudinary Upload Error:",
      error.response?.data || error.message
    );
    throw error;
  }
};

// Create a post (POST) - Requires authentication
router.post("/create-post", authMiddleware, async (req, res) => {
  try {
    const { caption, media, eventId } = req.body;

    // Validate media
    if (!Array.isArray(media) || media.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Media must be a non-empty array",
      });
    }

    // Upload all media to Cloudinary
    const mediaUrls = await Promise.all(media.map(uploadToCloudinary));

    // Create and save the new post
    const newPost = new Post({
      postID: uuidv4(),
      caption,
      media: mediaUrls,
      userID: req.user.userID,
      eventID: eventId || null, // Add event ID if provided
    });

    await newPost.save();

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      newPost,
    });
  } catch (error) {
    console.error("Post Creation Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while creating post",
      error: error.message,
    });
  }
});

router.get("/get-all-posts", async (req, res) => {
  try {
    // Get pagination parameters from query
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Find total count for pagination info
    const totalPosts = await Post.countDocuments();

    // Find posts sorted by creation date (newest first)
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

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
        console.log(
          "Invalid token in get-all-posts, proceeding without user context"
        );
      }
    }

    const postsWithUserDetails = await Promise.all(
      posts.map(async (post) => {
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

        return postObj;
      })
    );

    // Add metadata for pagination
    const totalPages = Math.ceil(totalPosts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      posts: postsWithUserDetails,
      pagination: {
        totalPosts,
        totalPages,
        currentPage: page,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching posts",
      error: error.message,
    });
  }
});

// Toggle like on a post - Requires authentication
router.post("/toggle-like/:postID", authMiddleware, toggleLike);

// Alternative route for the same functionality to match frontend expectations
router.post("/like-post/:postID", authMiddleware, toggleLike);

// Get like status for a post - Requires authentication
router.get("/like-status/:postID", authMiddleware, getLikeStatus);

// Get trending posts sorted by likes
router.get("/trending-posts", getTrendingPosts);

// Comment routes
// Get comments for a post
router.get("/comments/:postID", authMiddleware, getComments);

// Add a comment to a post
router.post("/comment/:postID", authMiddleware, addComment);

// Delete a comment
router.delete("/comment/:commentID", authMiddleware, deleteComment);

// Report routes
// Submit a report for a post
router.post("/report", authMiddleware, submitReport);

// Get all reports (admin only)
router.get("/reports", authMiddleware, adminMiddleware, getAllReports);

// Update report status (admin only)
router.put(
  "/report/:reportID",
  authMiddleware,
  adminMiddleware,
  updateReportStatus
);

// Save/unsave post routes
router.post("/save/:postID", authMiddleware, savePost);
router.post("/unsave/:postID", authMiddleware, unsavePost);
router.get("/check-saved/:postID", authMiddleware, checkSavedStatus);
router.get("/saved-posts", authMiddleware, getSavedPosts);

// Get posts made by the current user
router.get("/user-posts/:userId?", authMiddleware, getUserPosts);

// Update post route
router.put("/:postID", authMiddleware, updatePost);

// Delete post route
router.delete("/:postID", authMiddleware, deletePost);

module.exports = router;
