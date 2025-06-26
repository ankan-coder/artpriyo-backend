const express = require("express");
const router = express.Router();
const User = require("../models/userModel");
const Connection = require("../models/connectionModel");
const authMiddleware = require("../helpers/authMiddleware");
const mongoose = require("mongoose");

// First, we need to update the userModel to include connections
// Later, we'll create the connection model

// Fetch random users for suggestions
router.get("/fetch/random/users", authMiddleware, async (req, res) => {
  try {
    console.log("Fetching random users");
    console.log("User in request:", req.user);

    const currentUser = req.user._id || req.user.userID;
    console.log("Current user ID:", currentUser);

    // Get all existing connections (any status) to exclude from suggestions
    const connections = await Connection.find({
      $or: [{ requester: currentUser }, { recipient: currentUser }],
    });

    // Extract user IDs from connections to exclude
    const connectedUserIds = new Set();

    // Add current user to exclude list
    connectedUserIds.add(currentUser.toString());

    // Add all connected users to exclude list
    connections.forEach((conn) => {
      if (conn.requester.toString() === currentUser.toString()) {
        connectedUserIds.add(conn.recipient.toString());
      } else {
        connectedUserIds.add(conn.requester.toString());
      }
    });

    console.log(`Excluding ${connectedUserIds.size} users from suggestions`);

    // Convert Set to Array for MongoDB query
    const excludeIds = Array.from(connectedUserIds);

    // Get random users excluding connected users and current user
    const randomUsers = await User.find({
      _id: { $nin: excludeIds },
    })
      .select("-password")
      .limit(10);

    console.log("Found users:", randomUsers.length);

    res.status(200).json({
      success: true,
      users: randomUsers,
    });
  } catch (error) {
    console.error("Error fetching random users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching random users: " + error.message,
    });
  }
});

// Connect with another user (send friend request)
router.post("/connectFriend", authMiddleware, async (req, res) => {
  try {
    const { email } = req.body;
    const currentUserId = req.user._id;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find the user to connect with
    const userToConnect = await User.findOne({ email });

    if (!userToConnect) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if this is the same user
    if (userToConnect._id.toString() === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot connect with yourself",
      });
    }

    // Check if connection already exists
    const existingConnection = await Connection.findOne({
      $or: [
        { requester: currentUserId, recipient: userToConnect._id },
        { requester: userToConnect._id, recipient: currentUserId },
      ],
    });

    if (existingConnection) {
      return res.status(400).json({
        success: false,
        message: "Connection already exists or request already sent",
      });
    }

    // Create new connection
    const newConnection = new Connection({
      requester: currentUserId,
      recipient: userToConnect._id,
      status: "pending",
    });

    await newConnection.save();

    res.status(200).json({
      success: true,
      message: "Connection request sent successfully",
    });
  } catch (error) {
    console.error("Error connecting friend:", error);
    res.status(500).json({
      success: false,
      message: "Error sending connection request",
    });
  }
});

// Accept a connection request
router.post("/acceptFriend", authMiddleware, async (req, res) => {
  try {
    const { acceptUserId } = req.body;
    const currentUserId = req.user._id;

    if (!acceptUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the connection request
    const connectionRequest = await Connection.findOne({
      requester: acceptUserId,
      recipient: currentUserId,
      status: "pending",
    });

    if (!connectionRequest) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    // Update the connection status
    connectionRequest.status = "accepted";
    await connectionRequest.save();

    // Update follower and following counts
    await User.findByIdAndUpdate(currentUserId, {
      $inc: { followersCount: 1 },
    });
    await User.findByIdAndUpdate(acceptUserId, { $inc: { followingCount: 1 } });

    res.status(200).json({
      success: true,
      message: "Connection accepted successfully",
    });
  } catch (error) {
    console.error("Error accepting connection:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting connection",
    });
  }
});

// Delete a connection request
router.post("/delete/request/connection", authMiddleware, async (req, res) => {
  try {
    const { deleteRequestId } = req.body;
    const currentUserId = req.user._id;

    if (!deleteRequestId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Find the connection to delete
    const deletedConnection = await Connection.findOneAndDelete({
      $or: [
        { requester: deleteRequestId, recipient: currentUserId },
        { requester: currentUserId, recipient: deleteRequestId },
      ],
    });

    if (!deletedConnection) {
      return res.status(404).json({
        success: false,
        message: "Connection request not found",
      });
    }

    // If the connection was accepted, update the counts
    if (deletedConnection.status === "accepted") {
      if (deletedConnection.requester.toString() === currentUserId.toString()) {
        await User.findByIdAndUpdate(currentUserId, {
          $inc: { followingCount: -1 },
        });
        await User.findByIdAndUpdate(deleteRequestId, {
          $inc: { followersCount: -1 },
        });
      } else {
        await User.findByIdAndUpdate(currentUserId, {
          $inc: { followersCount: -1 },
        });
        await User.findByIdAndUpdate(deleteRequestId, {
          $inc: { followingCount: -1 },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: "Connection request deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting connection request:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting connection request",
    });
  }
});

// Fetch all connections (pending and accepted)
router.get("/fetch/connections", authMiddleware, async (req, res) => {
  try {
    // Get the current user's ID
    const currentUserId = req.user._id;

    console.log("Fetching connections for user:", currentUserId);

    // Find requests received by current user (pending)
    const requestConnections = await Connection.find({
      recipient: currentUserId,
      status: "pending",
    }).populate({
      path: "requester",
      select: "firstName lastName userName email profilePhoto image",
    });

    // Find requests sent by current user (pending)
    const pendingConnections = await Connection.find({
      requester: currentUserId,
      status: "pending",
    }).populate({
      path: "recipient",
      select: "firstName lastName userName email profilePhoto image",
    });

    // Find accepted connections (friends/followers)
    const acceptedConnectionsAsRequester = await Connection.find({
      requester: currentUserId,
      status: "accepted",
    }).populate({
      path: "recipient",
      select: "firstName lastName userName email profilePhoto image",
    });

    const acceptedConnectionsAsRecipient = await Connection.find({
      recipient: currentUserId,
      status: "accepted",
    }).populate({
      path: "requester",
      select: "firstName lastName userName email profilePhoto image",
    });

    // Log the results after variables are initialized
    console.log("Request connections found:", requestConnections.length);
    console.log("Pending connections found:", pendingConnections.length);
    console.log(
      "Accepted as requester:",
      acceptedConnectionsAsRequester.length
    );
    console.log(
      "Accepted as recipient:",
      acceptedConnectionsAsRecipient.length
    );

    // Format the response with proper user ID mapping
    const formattedRequests = requestConnections.map((conn) => ({
      _id: conn._id,
      user: conn.requester,
      requester: conn.requester._id,
      recipient: currentUserId,
      requestedAt: conn.requestedAt,
      status: "pending",
    }));

    const formattedPending = pendingConnections.map((conn) => ({
      _id: conn._id,
      user: conn.recipient,
      requester: currentUserId,
      recipient: conn.recipient._id,
      requestedAt: conn.requestedAt,
      status: "pending",
    }));

    // Format accepted connections with proper user ID mapping for profile filtering
    const formattedAcceptedAsRequester = acceptedConnectionsAsRequester.map(
      (conn) => ({
        _id: conn._id,
        user: conn.recipient,
        requester: conn.requester._id,
        recipient: conn.recipient._id,
        connectedAt: conn.updatedAt,
        type: "friend",
        status: "accepted",
      })
    );

    const formattedAcceptedAsRecipient = acceptedConnectionsAsRecipient.map(
      (conn) => ({
        _id: conn._id,
        user: conn.requester,
        requester: conn.requester._id,
        recipient: conn.recipient._id,
        connectedAt: conn.updatedAt,
        type: "friend",
        status: "accepted",
      })
    );

    // Combine all accepted connections
    const acceptedConnections = [
      ...formattedAcceptedAsRequester,
      ...formattedAcceptedAsRecipient,
    ];

    console.log("Total accepted connections:", acceptedConnections.length);
    console.log("Sample accepted connection:", acceptedConnections[0]);

    res.status(200).json({
      success: true,
      requestConnections: formattedRequests,
      pendingConnections: formattedPending,
      acceptedConnections: acceptedConnections,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching connections",
    });
  }
});

module.exports = router;
