const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const colors = require("colors");
const morgan = require("morgan");
const connectDB = require("./config/db");

// DOTENV
dotenv.config();

// MongoDB
connectDB();

// REST OBJECT
const app = express();

// middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// routes
app.get("", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to the Art Priyo App",
  });
});

app.use("/api/v1/auth", require("./routes/userRoutes"));
app.use("/api/event", require("./routes/eventRoutes"));

// PORT
const PORT = process.env.PORT || 8080;

// listen
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`.bgBlue.underline);
});
