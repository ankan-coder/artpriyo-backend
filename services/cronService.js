const cron = require("node-cron");
const Event = require("../models/eventModel");
const Post = require("../models/postModel");
const User = require("../models/userModel");
const Transaction = require("../models/transactionModel");

/**
 * Calculate winners for an ended event
 * @param {Object} event - The event object
 */
async function calculateEventWinners(event) {
  try {
    console.log(`🏆 Calculating winners for event: ${event.eventName}`);

    // Get all posts for this event with user details
    const eventPosts = await Post.find({ eventID: event._id.toString() })
      .sort({ likes: -1 }) // Sort by likes in descending order
      .limit(3); // Get top 3 posts

    if (eventPosts.length === 0) {
      console.log(`📭 No posts found for event: ${event.eventName}`);
      return;
    }

    const winners = {};
    const prizeDistribution = calculatePrizeDistribution(event.prizePool);

    // First place
    if (eventPosts[0]) {
      winners.first = eventPosts[0].userID;
      await creditWinnings(
        eventPosts[0].userID,
        prizeDistribution.first,
        event.eventName,
        "1st"
      );
      console.log(
        `🥇 First place: User ${eventPosts[0].userID} with ${eventPosts[0].likes} likes - Prize: ${prizeDistribution.first}`
      );
    }

    // Second place
    if (eventPosts[1]) {
      winners.second = eventPosts[1].userID;
      await creditWinnings(
        eventPosts[1].userID,
        prizeDistribution.second,
        event.eventName,
        "2nd"
      );
      console.log(
        `🥈 Second place: User ${eventPosts[1].userID} with ${eventPosts[1].likes} likes - Prize: ${prizeDistribution.second}`
      );
    }

    // Third place
    if (eventPosts[2]) {
      winners.third = eventPosts[2].userID;
      await creditWinnings(
        eventPosts[2].userID,
        prizeDistribution.third,
        event.eventName,
        "3rd"
      );
      console.log(
        `🥉 Third place: User ${eventPosts[2].userID} with ${eventPosts[2].likes} likes - Prize: ${prizeDistribution.third}`
      );
    }

    // Update event with winners
    await Event.findByIdAndUpdate(event._id, { winners });
    console.log(`✅ Winners updated for event: ${event.eventName}`);
  } catch (error) {
    console.error(
      `❌ Error calculating winners for event ${event.eventName}:`,
      error
    );
  }
}

/**
 * Calculate prize distribution based on total prize pool
 * @param {Number} totalPrize - Total prize pool
 * @returns {Object} - Prize distribution object
 */
function calculatePrizeDistribution(totalPrize) {
  return {
    first: Math.round(totalPrize * 0.5), // 50% for first place
    second: Math.round(totalPrize * 0.3), // 30% for second place
    third: Math.round(totalPrize * 0.2), // 20% for third place
  };
}

/**
 * Credit winnings to user account
 * @param {String} userID - User ID
 * @param {Number} amount - Prize amount
 * @param {String} eventName - Event name
 * @param {String} position - Winner position
 */
async function creditWinnings(userID, amount, eventName, position) {
  try {
    // Find user and update balance
    const user = await User.findOne({ userID });
    if (user) {
      user.balance = (user.balance || 0) + amount;
      await user.save();

      // Create transaction record
      const transaction = new Transaction({
        transactionID: `WIN_${Date.now()}_${userID}`,
        title: `${position} Prize - ${eventName}`,
        type: "credit",
        amount: amount,
        userID: userID,
      });
      await transaction.save();

      console.log(
        `💰 Credited ${amount} to user ${userID} for ${position} place in ${eventName}`
      );
    }
  } catch (error) {
    console.error(`❌ Error crediting winnings to user ${userID}:`, error);
  }
}

/**
 * Remove users from current events when event ends
 * @param {Object} event - The event object
 */
async function removeUsersFromCurrentEvent(event) {
  try {
    console.log(`🔄 Removing users from current event: ${event.eventName}`);

    // Find all users who have this event in their events array
    const users = await User.find({ events: event._id });

    for (const user of users) {
      // Remove the event from user's events array
      user.events = user.events.filter(
        (eventId) => eventId.toString() !== event._id.toString()
      );
      await user.save();
      console.log(`👤 Removed event from user: ${user.userID}`);
    }

    console.log(
      `✅ Removed ${users.length} users from event: ${event.eventName}`
    );
  } catch (error) {
    console.error(
      `❌ Error removing users from event ${event.eventName}:`,
      error
    );
  }
}

/**
 * Check for started events and update their status to ongoing
 */
async function checkStartedEvents() {
  try {
    console.log("🚀 Checking for started events...");

    // Get current date and time in IST using more reliable method
    const now = new Date();

    // Log raw date for debugging
    console.log(`🕒 Raw current date (server time): ${now.toISOString()}`);

    // Add 5 hours and 30 minutes for IST conversion (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const currentDateIST = new Date(now.getTime() + istOffset);

    console.log(`🕒 Current date in IST: ${currentDateIST.toISOString()}`);

    // Format current date to YYYY-MM-DD
    const currentDateString = currentDateIST.toISOString().split("T")[0];

    console.log(`📅 Checking against current date: ${currentDateString}`);

    // Find events that should have started (simpler logic for different time formats)
    const startedEvents = await Event.find({
      startDate: { $lte: currentDateString },
      status: "upcoming",
    });

    console.log(
      `🔍 Found ${startedEvents.length} events that should have started`
    );

    for (const event of startedEvents) {
      console.log(
        `📅 Event "${event.eventName}" start: ${event.startDate}, current: ${currentDateString}`
      );

      // Check if event has already ended
      const hasEnded = event.endDate < currentDateString;

      if (!hasEnded) {
        await Event.findByIdAndUpdate(event._id, { status: "ongoing" });
        console.log(
          `✅ Event status updated to 'ongoing' for: ${event.eventName}`
        );
      } else {
        console.log(
          `⚠️ Event "${event.eventName}" has already ended, will be processed by checkEndedEvents`
        );
      }
    }
  } catch (error) {
    console.error("❌ Error in checkStartedEvents:", error);
  }
}

/**
 * Check for ended events and process them
 */
async function checkEndedEvents() {
  try {
    console.log("⏰ Checking for ended events...");

    // Get current date and time in IST using more reliable method
    const now = new Date();

    // Log raw date for debugging
    console.log(`🕒 Raw current date (server time): ${now.toISOString()}`);

    // Add 5 hours and 30 minutes for IST conversion (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const currentDateIST = new Date(now.getTime() + istOffset);

    console.log(`🕒 Current date in IST: ${currentDateIST.toISOString()}`);

    // Format current date to YYYY-MM-DD
    const currentDateString = currentDateIST.toISOString().split("T")[0];

    console.log(`📅 Checking against current date: ${currentDateString}`);

    // Find events that should have ended (simpler logic for different date formats)
    const endedEvents = await Event.find({
      endDate: { $lt: currentDateString },
      status: "ongoing",
    });

    console.log(`🔍 Found ${endedEvents.length} events that have ended`);

    for (const event of endedEvents) {
      console.log(`\n🎯 Processing ended event: ${event.eventName}`);
      console.log(
        `📅 Event ended on: ${event.endDate}, current: ${currentDateString}`
      );

      try {
        // 1. Remove from current events (remove from users' events array)
        await removeUsersFromCurrentEvent(event);

        // 2. Set the event status to ended
        await Event.findByIdAndUpdate(event._id, { status: "completed" });
        console.log(
          `✅ Event status updated to 'completed' for: ${event.eventName}`
        );

        // 3. Calculate winners
        await calculateEventWinners(event);

        console.log(
          `🎉 Successfully processed ended event: ${event.eventName}\n`
        );
      } catch (error) {
        console.error(`❌ Error processing event ${event.eventName}:`, error);
      }
    }

    if (endedEvents.length === 0) {
      console.log("✨ No ended events to process at this time");
    }
  } catch (error) {
    console.error("❌ Error in checkEndedEvents:", error);
  }
}

/**
 * Start the cron job to check for ended events
 */
function startEventEndChecker() {
  // Run every hour at minute 0
  // cron.schedule(
  //   "0 * * * *",
  //   () => {
  //     console.log("\n🚀 === Event Status Checker Cron Job Started ===");
  //     checkStartedEvents();
  //     checkEndedEvents();
  //   },
  //   {
  //     scheduled: true,
  //     timezone: "Asia/Kolkata", // Set timezone to IST
  //   }
  // );

  // For development/testing, uncomment to run every 10 seconds
  cron.schedule(
    "*/10 * * * * *",
    () => {
      console.log("\n🚀 === Event Status Checker Cron Job Started ===");
      checkStartedEvents();
      checkEndedEvents();
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    }
  );

  console.log("🕐 Event status checker cron job scheduled to run every hour");

  // Also run immediately when server starts for testing
  console.log("🧪 Running initial check for event statuses...");
  checkStartedEvents();
  checkEndedEvents();
}

module.exports = {
  startEventEndChecker,
  checkEndedEvents, // Export for manual testing
  checkStartedEvents, // Export for manual testing
};
