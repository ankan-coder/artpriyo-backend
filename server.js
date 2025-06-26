const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const { startEventEndChecker } = require("./services/cronService");

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  console.error("ERROR: JWT_SECRET environment variable is not set!".bgRed);
  process.exit(1);
}

if (!process.env.MONGO_URL) {
  console.error("ERROR: MONGO_URL environment variable is not set!".bgRed);
  process.exit(1);
}

console.log("Environment variables validated".green);

// Connect to MongoDB
connectDB();
console.log(
  "MongoDB Connection Status:".yellow,
  mongoose.connection.readyState === 1 ? "Connected".green : "Disconnected".red
);

// Initialize Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: "http://192.168.230.115:19006", // or "*" only for local tests
  credentials: true
}));

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase payload size
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

// Debug middleware to log all requests
app.use((req, res, next) => {
  // Request logging
  console.log("\n=== New Request ===".cyan);
  console.log(`📍 ${new Date().toISOString()} - ${req.method} ${req.url}`.blue);
  console.log("👤 User IP:", req.ip);
  console.log("🔑 Headers:", JSON.stringify(req.headers, null, 2));

  if (Object.keys(req.body).length) {
    console.log("📦 Request Body:", JSON.stringify(req.body, null, 2));
  }
  if (Object.keys(req.query).length) {
    console.log("❓ Query Params:", JSON.stringify(req.query, null, 2));
  }

  // Response logging
  const originalSend = res.send;
  res.send = function (body) {
    console.log("📤 Response Status:", res.statusCode);
    console.log("=== Request End ===\n".cyan);
    return originalSend.call(this, body);
  };

  // Request timing
  req._startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - req._startTime;
    console.log(`⏱️ Request Duration: ${duration}ms`.yellow);
  });

  next();
});

// Default route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Art Priyo App",
  });
});

// Routes
app.use("/api/v1/auth", require("./routes/userRoutes"));
app.use("/api/event", require("./routes/eventRoutes"));
app.use("/api/v1/event", require("./routes/eventRoutes"));
app.use("/api/v1/transactions", require("./routes/transactionRoutes"));
app.use("/api/v1/post", require("./routes/postRoutes"));
app.use("/api/v1/user", require("./routes/connectionRoutes"));
app.use("/api/admin", require("./routes/administratorRoutes"));

// To be added later
app.use("/api/v1/notification", require("./routes/notificationRoutes"));

// Catch-all route to help debug missing endpoints
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("🚨 Error:".red, err.message);
  console.error("Stack:", err.stack);
  console.error("Request details:".red);
  console.error("- URL:", req.url);
  console.error("- Method:", req.method);
  console.error("- Body:", req.body);
  console.error("- Query:", req.query);
  console.error("- Params:", req.params);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// Process monitoring
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:".red, promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception:".red, error);
  process.exit(1);
});

// Memory usage logging (every 5 minutes)
setInterval(() => {
  const used = process.memoryUsage();
  console.log("\n📊 Memory Usage:".cyan);
  for (let key in used) {
    console.log(
      `${key}: ${Math.round((used[key] / 1024 / 1024) * 100) / 100} MB`
    );
  }
}, 300000);

// Define port
const PORT = process.env.PORT || 8080;

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.bgBlue.underline);
  console.log("📱 Server Configuration:".cyan);
  console.log("- Environment:", process.env.NODE_ENV || "development");
  console.log("- MongoDB URL:", process.env.MONGO_URL.substring(0, 20) + "...");
  console.log("- CORS Enabled:", true);
  console.log("- Max Request Size:", "50mb");
  console.log("=== Server Started ===\n".green);
  
  // Start cron jobs
  console.log("🕐 Starting cron jobs...".yellow);
  startEventEndChecker();
  console.log("✅ Cron jobs initialized".green);
});
