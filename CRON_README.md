# Event Management Cron Job

This cron job automatically manages event statuses and processes winners when events end.

## Features

### 1. **Event Status Management**
- **Upcoming → Ongoing**: Automatically updates event status when start date/time is reached
- **Ongoing → Ended**: Automatically updates event status when end date/time is reached

### 2. **Winner Calculation**
When an event ends, the system automatically:
- Finds all posts submitted for the event
- Sorts them by number of likes (descending)
- Selects top 3 posts as winners
- Distributes prize money:
  - **1st Place**: 50% of prize pool
  - **2nd Place**: 30% of prize pool  
  - **3rd Place**: 20% of prize pool

### 3. **User Management**
- Removes ended events from users' current events array
- Credits prize money to winners' accounts
- Creates transaction records for prize winnings

## How It Works

### Cron Schedule
- **Frequency**: Every hour (at minute 0)
- **Timezone**: Asia/Kolkata (IST)
- **Pattern**: `0 * * * *`

### Functions

#### `checkStartedEvents()`
- Finds events with status 'upcoming' that should have started
- Updates their status to 'ongoing'
- Considers both date and time

#### `checkEndedEvents()`
- Finds events with status 'upcoming' or 'ongoing' that should have ended
- Updates their status to 'ended'
- Removes event from all participants' events array
- Calculates and awards prizes to top 3 winners
- Creates transaction records

## Database Schema Updates

### Event Model
Added new fields:
```javascript
status: { 
  type: String, 
  enum: ['upcoming', 'ongoing', 'ended'], 
  default: 'upcoming' 
},
winners: {
  first: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  second: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  third: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}
```

## API Endpoints

### Updated Routes
- `GET /api/event/upcoming-events` - Returns events with status 'upcoming'
- `GET /api/event/ongoing-events` - Returns events with status 'ongoing'  
- `GET /api/event/ended-events` - Returns events with status 'ended'

### Manual Trigger (For Testing)
- `POST /api/event/check-event-status` - Manually triggers event status check

## Testing

### Using the Test Script
```bash
node test-cron.js
```

This will:
1. Show current events and their status
2. Run the cron functions manually
3. Display updated status after processing

### Manual API Testing
You can trigger the cron job manually by calling:
```
POST /api/event/check-event-status
Headers: Authorization: Bearer <your-jwt-token>
```

## Prize Distribution Logic

```javascript
// Example: Prize Pool = 1000
const prizeDistribution = {
  first: 500,   // 50% = 500
  second: 300,  // 30% = 300  
  third: 200    // 20% = 200
};
```

## Transaction Records

When prizes are awarded, transaction records are created:
```javascript
{
  transactionID: "WIN_<timestamp>_<userID>",
  title: "<position> Prize - <eventName>",
  type: "credit",
  amount: <prize_amount>,
  userID: <winner_userID>
}
```

## Logging

The cron job provides detailed logging:
- 🚀 Event status checker startup
- ⏰ Hourly execution
- 🔍 Found events to process
- 🎯 Processing individual events
- 🏆 Winner calculations
- 💰 Prize distributions
- ✅ Success confirmations
- ❌ Error handling

## Error Handling

- Individual event processing errors don't stop the entire batch
- Detailed error logging for debugging
- Graceful handling of missing data
- Timezone-aware date/time comparisons

## Installation

The cron job is automatically started when the server starts. No additional configuration needed.

## Dependencies

- `node-cron`: For scheduling
- `mongoose`: For database operations
- Existing models: Event, Post, User, Transaction
