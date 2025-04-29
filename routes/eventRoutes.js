const express = require("express");
const Event = require("../models/eventModel");
const userModel = require("../models/userModel");
const Transaction = require("../models/transactionModel");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// Create Event
// Create Event (Store system time)
router.post("/create-event", authMiddleware, async (req, res) => {
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
      creator: req.user.userID,
      participants: [req.user.userID], // Creator is automatically a participant
    });

    await newEvent.save();
    res.status(201).json({ message: "Event created successfully", newEvent });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get All Events
// Get Upcoming Events (Sorted by Start Date)
router.get("/upcoming-events", async (req, res) => {
  try {
    const currentDate = new Date().toISOString().split("T")[0]; // Get today's date (YYYY-MM-DD)

    const upcomingEvents = await Event.find({
      startDate: { $gte: currentDate },
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
    // Get current date in IST
    const currentDateIST = new Date()
      .toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
      .split(",")[0];

    // Convert IST date to YYYY-MM-DD format
    const [month, day, year] = currentDateIST.split("/");
    const formattedDateIST = `${year}-${month.padStart(2, "0")}-${day.padStart(
      2,
      "0"
    )}`;

    console.log("Current Date in IST:", formattedDateIST);

    const ongoingEvents = await Event.find({
      startDate: { $lte: formattedDateIST }, // Events that started in the past or today
      endDate: { $gte: formattedDateIST }, // Events that end in the future or today
    }).sort({ startDate: 1 }); // Sort by start date

    res.status(200).json(ongoingEvents);
  } catch (error) {
    console.error("Error fetching ongoing events:", error);
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
// DELETE event by ID
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

// Join Event with Payment Verification
router.post("/join-event/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { paymentId } = req.body;
    const { userID } = req.user;

    // Find the user
    const user = await userModel.findOne({ userID });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user is already participating in any event
    if (user.events && user.events.length > 0) {
      // Find the event user is currently participating in
      const currentEvent = await Event.findById(user.events[0]);
      return res.status(400).json({ 
        error: "You are already participating in an event",
        currentEvent: {
          _id: currentEvent._id,
          eventName: currentEvent.eventName,
          startDate: currentEvent.startDate,
          endDate: currentEvent.endDate
        }
      });
    }

    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Verify payment
    if (!paymentId) {
      return res.status(400).json({ error: "Payment verification required" });
    }

    // Add event to user's events array
    user.events = user.events || [];
    user.events.push(eventId);
    await user.save();

    // Create transaction record
    const transaction = new Transaction({
      transactionID: paymentId,
      title: `Joined event: ${event.eventName}`,
      type: "debit",
      amount: event.entryFee,
      userID: userID
    });
    await transaction.save();

    res.status(200).json({ 
      success: true, 
      message: "Successfully joined the event",
      event: event
    });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Join Event
router.post("/join-event/:eventId", authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user.userID;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if user is already a participant
    if (event.participants.includes(userId)) {
      return res.status(400).json({ error: "Already joined this event" });
    }

    // Add user to participants
    event.participants.push(userId);
    await event.save();

    res.status(200).json({ message: "Successfully joined the event", event });
  } catch (error) {
    console.error("Error joining event:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
