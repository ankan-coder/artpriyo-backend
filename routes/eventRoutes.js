const express = require("express");
const Event = require("../models/eventModel");

const router = express.Router();

// Create Event
// Create Event (Store system time)
router.post("/create-event", async (req, res) => {
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
router.delete("/event/:id", async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Internal Server Error" });
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

module.exports = router;
