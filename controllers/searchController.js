const User = require("../models/userModel");
const Event = require("../models/eventModel");

const searchController = async (req, res) => {
  try {
    const { searchTerm } = req.body;
    console.log("Search request received with term:", searchTerm);

    if (!searchTerm || searchTerm.trim() === "") {
      console.log("Empty search term received");
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    // Create a case-insensitive regex pattern for partial matching
    const searchPattern = new RegExp(searchTerm, 'i');

    // Search for events with proper model fields
    const events = await Event.find({
      $or: [
        { eventName: searchPattern },
        { rules: searchPattern },
      ],
    })
    .select("eventName image startDate endDate startTime endTime prizePool entryFee")
    .populate('creator', 'firstName lastName userName image')
    .populate('participants', 'firstName lastName userName image');

    console.log("Events query result:", events);

    // Search for users with proper model fields
    const users = await User.find({
      $or: [
        { firstName: searchPattern },
        { lastName: searchPattern },
        { userName: searchPattern },
        { email: searchPattern },
        { description: searchPattern },
      ],
    })
    .select("firstName lastName userName image email description accountType followersCount followingCount");

    console.log("Users query result:", users);

    // Format the response
    const formattedEvents = events.map(event => ({
      _id: event._id,
      eventName: event.eventName,
      eventImage: event.image,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      prizePool: event.prizePool,
      entryFee: event.entryFee,
      creator: event.creator,
      participants: event.participants,
      isLive: new Date(event.endDate) > new Date(),
    }));

    const formattedUsers = users.map(user => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      image: user.image,
      email: user.email,
      description: user.description,
      accountType: user.accountType,
      followersCount: user.followersCount,
      followingCount: user.followingCount,
    }));

    console.log("Formatted response:", {
      events: formattedEvents,
      users: formattedUsers
    });

    return res.status(200).json({
      success: true,
      events: formattedEvents,
      users: formattedUsers,
      message: `Found ${events.length} events and ${users.length} users`,
    });
  } catch (error) {
    console.error("Search error details:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching",
      error: error.message,
    });
  }
};

module.exports = searchController; 