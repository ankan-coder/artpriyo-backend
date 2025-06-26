const express = require("express");
const Event = require("../models/eventModel");
const userModel = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const { authMiddleware } = require("../middlewares/authMiddleware");
const {
  checkEndedEvents,
  checkStartedEvents,
} = require("../services/cronService");

const router = express.Router();

// Create Event
// Create Event (Store system time)
router.post("/create-event", authMiddleware, async (req, res) => {
  console.log("Creating event with user:", req.user);

  try {
    const {
      eventName,
      entryFee,
      prizePool,
      startDate,
      endDate,
      startTime,
      endTime,
      rules,
      image,
    } = req.body;

    if (
      !eventName ||
      !entryFee ||
      !prizePool ||
      !startDate ||
      !endDate ||
      !startTime ||
      !endTime ||
      !rules ||
      !image
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newEvent = new Event({
      eventName,
      entryFee,
      prizePool,
      startDate,
      endDate,
      startTime,
      endTime,
      rules,
      image,
      creator: req.user._id,
    });

    await newEvent.save();
    res.status(201).json({ message: "Event created successfully", newEvent });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Event Leaderboard
router.get("/get-event-leaderboard/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    console.log("Event ID: " + eventId);

    // Find the event
    const event = await Event.findById(eventId);

    console.log("Event: " + JSON.stringify(event, null, 2));

    if (!event) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    // Get participant IDs from the event
    const participantIds = event.participants || [];

    console.log("Participant IDs: " + JSON.stringify(participantIds, null, 2));

    if (participantIds.length === 0) {
      return res.status(200).json({
        success: true,
        event,
        participants: [],
        message: "No participants in this event yet",
      });
    }

    // Get User model
    const User = require("../models/userModel");

    // Get Post model
    const Post = require("../models/postModel");

    // Fetch complete details of all participants
    const participants = await User.find({
      _id: { $in: participantIds },
    }).select("-password");

    console.log("Participants: " + JSON.stringify(participants, null, 2));

    // Map userIDs for easier reference
    const userIDsMap = {};
    participants.forEach(p => {
      userIDsMap[p._id.toString()] = p.userID;
    });

    console.log("UserIDs Map:", userIDsMap);

    // Fetch all posts made by participants for this event - Note the field names match the schema
    const posts = await Post.find({
      userID: { $in: Object.values(userIDsMap) },
      eventID: eventId,
    });

    console.log(`Found ${posts.length} posts for event ${eventId}`);
    
    if (posts.length > 0) {
      console.log("Sample post:", JSON.stringify(posts[0], null, 2));
    }
    
    // Calculate metrics for each participant
    const participantsWithStats = participants.map((participant) => {
      // Find posts made by this participant for this event
      const userPosts = posts.filter(
        (post) => post.userID === participant.userID
      );

      console.log(`User ${participant.userName} has ${userPosts.length} posts`);

      // Calculate total likes
      const totalLikes = userPosts.reduce(
        (total, post) => total + (post.likes || 0),
        0
      );

      // Create participant data with stats
      return {
        participant: {
          _id: participant._id,
          userID: participant.userID,
          name: `${participant.firstName} ${participant.lastName}`,
          userName: participant.userName,
          image: participant.image || "https://via.placeholder.com/100",
        },
        stats: {
          totalPosts: userPosts.length,
          totalLikes: totalLikes,
          posts: userPosts.map((post) => ({
            postId: post._id,
            postID: post.postID,
            caption: post.caption,
            media: post.media && post.media.length > 0 ? post.media[0] : null,
            createdAt: post.createdAt,
            likes: post.likes || 0,
          })),
        },
      };
    });

    // Sort participants by total likes (descending)
    participantsWithStats.sort(
      (a, b) => b.stats.totalLikes - a.stats.totalLikes
    );
    
    // Add rank property to each participant
    participantsWithStats.forEach((participant, index) => {
      participant.rank = index + 1;
      participant.badge =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "";
    });

    // Return the event with participant details and stats
    res.status(200).json({
      success: true,
      event,
      leaderboard: participantsWithStats,
    });
  } catch (error) {
    console.error("Error fetching event leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Get All Events
router.get("/get-events", async (req, res) => {
  try {
    const events = await Event.find();
    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Upcoming Events (Sorted by Start Date)
router.get("/upcoming-events", async (req, res) => {
  try {
    const upcomingEvents = await Event.find({
      status: "upcoming",
    }).sort({ startDate: 1 }); // Sort by soonest event first

    res.status(200).json(upcomingEvents);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Ongoing Events (Currently Active)
router.get("/ongoing-events", async (req, res) => {
  try {
    // Use the status field for more accurate ongoing events
    const ongoingEvents = await Event.find({
      status: "ongoing",
    }).sort({ startDate: 1 }); // Sort by start date

    res.status(200).json(ongoingEvents);
  } catch (error) {
    console.error("Error fetching ongoing events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Ended Events
router.get("/ended-events", async (req, res) => {
  try {
    const endedEvents = await Event.find({
      status: "ended",
    }).sort({ endDate: -1 }); // Sort by most recently ended first

    res.status(200).json(endedEvents);
  } catch (error) {
    console.error("Error fetching ended events:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get Single Event by ID
router.get("/event/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(200).json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Delete Event
router.delete("/delete-event/:id", async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// Update Event
router.put("/update-event/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { eventName, startDate, endDate, startTime, endTime, entryFee } =
      req.body;

    // Validate required fields
    if (
      !eventName ||
      !startDate ||
      !endDate ||
      !startTime ||
      !endTime ||
      entryFee === undefined
    ) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return res
        .status(400)
        .json({ error: "End date cannot be before start date!" });
    }

    // Validate entry fee
    if (isNaN(entryFee) || parseFloat(entryFee) < 0) {
      return res
        .status(400)
        .json({ error: "Entry fee must be a positive number!" });
    }

    // Find and update the event
    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { eventName, startDate, endDate, startTime, endTime, entryFee },
      { new: true } // Return the updated document
    );

    if (!updatedEvent) {
      return res.status(404).json({ error: "Event not found!" });
    }

    res
      .status(200)
      .json({ message: "Event updated successfully!", updatedEvent });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

// Join Event
router.post("/join-event/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { paymentId } = req.body; // Payment ID for receipt/verification
    const userId = req.user._id; // From authMiddleware

    // Validate eventId
    if (!eventId) {
      return res.status(400).json({ error: "Event ID is required" });
    }

    // Find the user by ID
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("User joining event:", user);

    // Check if user is already participating in any event
    if (user.events && user.events.length > 0) {
      // Find the event user is currently participating in
      const currentEvent = await Event.findById(user.events[0]);
      return res.status(400).json({
        error: "You are already participating in an event",
        currentEvent: currentEvent
          ? {
              _id: currentEvent._id,
              eventName: currentEvent.eventName,
              startDate: currentEvent.startDate,
              endDate: currentEvent.endDate,
            }
          : null,
      });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get entry fee amount from event
    const amount = event.entryFee;

    // Validate entry fee
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid entry fee amount" });
    }

    // Get user's current balance from Database

    const currentBalance = user.balance || 0;
    user.balance = currentBalance - amount;

    // Generate a transaction ID
    const transactionID = `txn-${Date.now()}-${user._id}`;
    const title = `Entry Fee for ${event.eventName}`;
    const type = "debit";

    // Add a transaction for the entry fee
    const newTransaction = new Transaction({
      transactionID,
      title,
      time: new Date(),
      type,
      amount,
      userID: user.userID || user._id,
      paymentId,
    });

    await newTransaction.save();

    // Add event to user's events array
    user.events = user.events || [];
    user.events.push(eventId);
    await user.save();

    // Update event participants count
    event.participants = event.participants || [];
    event.participants.push(user.userID || user._id);
    await event.save();

    // Response with all details
    return res.status(200).json({
      success: true,
      message: "Successfully joined the event",
      event: event,
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Manual trigger for event status check (for testing)
router.post("/check-event-status", authMiddleware, async (req, res) => {
  try {
    console.log(
      "🧪 Manual event status check triggered by user:",
      req.user.userID
    );

    await checkStartedEvents();
    await checkEndedEvents();

    res.status(200).json({
      success: true,
      message: "Event status check completed successfully",
    });
  } catch (error) {
    console.error("Error in manual event status check:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
