const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const colors = require("colors");
const morgan = require("morgan");
const connectDB = require("./config/db");

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

// Initialize Express app
const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase payload size
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(morgan("dev"));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
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

// Catch-all route to help debug missing endpoints
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.url}`
  });
});

// Define port
const PORT = process.env.PORT || 8080;

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.bgBlue.underline);
});
