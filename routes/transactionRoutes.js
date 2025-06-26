const express = require("express");
const Transaction = require("../models/transactionModel");
const authMiddleware = require("../helpers/authMiddleware");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");

const router = express.Router();

// Create a transaction (POST) - Requires authentication
router.post("/add-transaction", authMiddleware, async (req, res) => {
  try {
    const { transactionID, title, time, type, amount } = req.body;
    const { userID } = req.user;

    // Validate user authentication
    if (!userID) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    // Validate required fields
    if (!transactionID || !title || !type || !amount) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Validate transaction type
    if (!["credit", "debit"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid transaction type",
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    const newTransaction = new Transaction({
      transactionID,
      title,
      time: time ? new Date(time) : new Date(),
      type,
      amount,
      userID,
    });

    await newTransaction.save();

    res.status(201).json({
      success: true,
      transaction: newTransaction,
      message: "Transaction added successfully",
    });
  } catch (error) {
    console.error("Transaction creation error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating transaction",
      error: error.message,
    });
  }
});

// Get all transactions for logged-in user (GET)
router.get("/get-transactions", authMiddleware, async (req, res) => {
  try {
    console.log("Fetching transactions for user:", req.user);

    // Get user ID from authenticated request
    const { userID } = req.user;

    // Validate user authentication
    if (!userID) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User not authenticated",
      });
    }

    // Build query with only the authenticated user's ID
    const query = { userID };

    // Get all transactions for this user, sorted by date (newest first)
    const transactions = await Transaction.find(query).sort({ time: -1 }); // Sort by most recent first

    // Get total count
    const total = transactions.length;

    // Calculate total credits and debits directly from the transactions array
    const totalCredit = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalDebit = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    const netAmount = totalCredit - totalDebit;

    res.status(200).json({
      success: true,
      transactions,
      total,
      summary: {
        totalCredit,
        totalDebit,
        netAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
});

// Get all transactions (Admin only)
// Complete route: /api/v1/transactions/admin/get-transactions
router.get("/admin/get-transactions", authMiddleware, async (req, res) => {
  console.log("[ADMIN TRANSACTIONS] Route handler called");
  try {
    // Get query parameters
    const {
      page = 1,
      limit = 10,
      type,
      startDate,
      endDate,
      search,
      userID,
    } = req.query;

    console.log("[ADMIN TRANSACTIONS] Query parameters:", {
      page,
      limit,
      type,
      startDate,
      endDate,
      search,
      userID,
    });

    // Build query
    const query = {};

    // Add type filter if provided
    if (type && ["credit", "debit"].includes(type)) {
      query.type = type;
    }

    // Add user filter if provided
    if (userID) {
      query.userID = userID;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { transactionID: { $regex: search, $options: "i" } },
      ];
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      query.time = {};
      if (startDate) query.time.$gte = new Date(startDate);
      if (endDate) query.time.$lte = new Date(endDate);
    }

    console.log(
      "[ADMIN TRANSACTIONS] Constructed query:",
      JSON.stringify(query)
    );

    // Calculate pagination
    const skip = (page - 1) * limit;
    console.log("[ADMIN TRANSACTIONS] Pagination calculated:", {
      skip,
      limit: parseInt(limit),
    });

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);
    console.log("[ADMIN TRANSACTIONS] Total matching documents:", total);

    // Get transactions with pagination and sorting
    console.log(
      "[ADMIN TRANSACTIONS] Fetching transactions with pagination..."
    );
    const transactions = await Transaction.find(query)
      .sort({ time: -1 }) // Sort by most recent first
      .skip(skip)
      .limit(parseInt(limit));

    console.log(
      "[ADMIN TRANSACTIONS] Retrieved transactions count:",
      transactions.length
    );
    console.log(
      "[ADMIN TRANSACTIONS] First transaction (if exists):",
      transactions.length > 0
        ? {
            id: transactions[0]._id,
            transactionID: transactions[0].transactionID,
            amount: transactions[0].amount,
          }
        : "No transactions found"
    );

    // Get all unique user IDs from the transactions
    const userIds = [
      ...new Set(transactions.map((transaction) => transaction.userID)),
    ];
    console.log("[ADMIN TRANSACTIONS] Unique user IDs found:", userIds);

    // Fetch user details for all users in one query
    const User = require("../models/userModel");
    const users = await User.find({ userID: { $in: userIds } }).select(
      "userID firstName lastName email phone"
    );
    console.log(
      "[ADMIN TRANSACTIONS] Retrieved user details count:",
      users.length
    );

    // Create a map of user details by userID for quick lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user.userID] = user;
    });
    console.log("[ADMIN TRANSACTIONS] Created user lookup map");

    // Add user details to each transaction
    const transactionsWithUserDetails = transactions.map((transaction) => {
      const user = userMap[transaction.userID] || null;
      console.log("User: ", user);
      return {
        ...transaction.toObject(),
        user: user
          ? {
              userID: user.userID,
              name: user.firstName + " " + user.lastName,
              email: user.email
            }
          : null,
      };
    });
    console.log("[ADMIN TRANSACTIONS] Added user details to transactions");

    // Calculate total amount for the filtered transactions
    console.log(
      "[ADMIN TRANSACTIONS] Calculating transaction totals via aggregation..."
    );
    const totalAmount = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0],
            },
          },
        },
      },
    ]);

    console.log(
      "[ADMIN TRANSACTIONS] Aggregation results:",
      JSON.stringify(totalAmount)
    );

    const responseData = {
      success: true,
      transactions: transactionsWithUserDetails,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalCredit: totalAmount[0]?.totalCredit || 0,
        totalDebit: totalAmount[0]?.totalDebit || 0,
        netAmount:
          (totalAmount[0]?.totalCredit || 0) -
          (totalAmount[0]?.totalDebit || 0),
      },
    };

    console.log(
      "[ADMIN TRANSACTIONS] Sending response with pagination:",
      responseData.pagination
    );
    console.log("[ADMIN TRANSACTIONS] Response summary:", responseData.summary);

    res.status(200).json(responseData);
  } catch (error) {
    console.error("[ADMIN TRANSACTIONS] Error details:", {
      message: error.message,
      stack: error.stack,
      query: req.query,
    });
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching transactions",
      error: error.message,
    });
  }
});

module.exports = router;
