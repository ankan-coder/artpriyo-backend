const Report = require("../models/reportModel");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Submit a report for a post
const submitReport = async (req, res) => {
  try {
    const { postId, reason } = req.body;
    const userID = req.user.userID;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Report reason is required",
      });
    }

    // Check if post exists
    let post;

    // Try to find post by postID first
    post = await Post.findOne({ postID: postId });

    // If not found, check if postID is a valid MongoDB ID and try to find by _id
    if (!post && mongoose.Types.ObjectId.isValid(postId)) {
      post = await Post.findById(postId);
    }

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Check if user already reported this post
    const existingReport = await Report.findOne({
      postID: post.postID,
      userID: userID,
    });

    if (existingReport) {
      return res.status(210).json({
        success: false,
        message: "You've already reported the post",
      });
    }

    // Create new report
    const newReport = new Report({
      reportID: uuidv4(),
      postID: post.postID,
      userID,
      reason,
      status: "pending",
    });

    await newReport.save();

    res.status(201).json({
      success: true,
      message: "Report submitted successfully",
    });
  } catch (error) {
    console.error("Report Submission Error:", error);
    res.status(500).json({
      success: false,
      message: "Error while submitting report",
      error: error.message,
    });
  }
};

// Get all reports (admin only)
const getAllReports = async (req, res) => {
  try {
    // The admin check is now done by middleware
    const reports = await Report.find().sort({ createdAt: -1 });

    // Get post and user details for each report
    const reportsWithDetails = await Promise.all(
      reports.map(async (report) => {
        const post = await Post.findOne({ postID: report.postID });
        const user = await User.findById(report.userID);

        return {
          _id: report._id,
          reportID: report.reportID,
          reason: report.reason,
          status: report.status,
          createdAt: report.createdAt,
          updatedAt: report.updatedAt,
          post: post
            ? {
                _id: post._id,
                postID: post.postID,
                caption: post.caption,
                media: post.media[0], // First media item for preview
              }
            : null,
          reporter: user
            ? {
                _id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
              }
            : null,
        };
      })
    );

    res.status(200).json({
      success: true,
      reports: reportsWithDetails,
    });
  } catch (error) {
    console.error("Error Fetching Reports:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching reports",
      error: error.message,
    });
  }
};

// Update report status (admin only)
const updateReportStatus = async (req, res) => {
  try {
    const { reportID } = req.params;
    const { status } = req.body;

    // Check if status is valid
    if (!["pending", "reviewed", "resolved", "dismissed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    // The admin check is now done by middleware
    const report = await Report.findOne({
      $or: [
        { reportID },
        ...(mongoose.Types.ObjectId.isValid(reportID)
          ? [{ _id: reportID }]
          : []),
      ],
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    report.status = status;
    report.updatedAt = Date.now();
    await report.save();

    res.status(200).json({
      success: true,
      message: "Report status updated successfully",
    });
  } catch (error) {
    console.error("Error Updating Report Status:", error);
    res.status(500).json({
      success: false,
      message: "Error while updating report status",
      error: error.message,
    });
  }
};

module.exports = {
  submitReport,
  getAllReports,
  updateReportStatus,
};
