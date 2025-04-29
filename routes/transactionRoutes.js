const express = require("express");
const Transaction = require("../models/transactionModel");
const authMiddleware = require("../helpers/authMiddleware");

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
        message: "Unauthorized: User not authenticated" 
      });
    }

    // Validate required fields
    if (!transactionID || !title || !type || !amount) {
      return res.status(400).json({ 
        success: false, 
        message: "All fields are required" 
      });
    }

    // Validate transaction type
    if (!["credit", "debit"].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid transaction type" 
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid amount" 
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
      message: "Transaction added successfully"
    });
  } catch (error) {
    console.error("Transaction creation error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error creating transaction", 
      error: error.message 
    });
  }
});

// Get all transactions for logged-in user (GET)
router.get("/get-transactions", authMiddleware, async (req, res) => {
  try {
    const { userID } = req.user;
    
    // Validate user authentication
    if (!userID) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: User not authenticated" 
      });
    }

    // Get query parameters
    const { 
      page = 1, 
      limit = 10, 
      type, 
      startDate, 
      endDate 
    } = req.query;

    // Build query with authenticated user's ID
    const query = { userID };
    
    // Add type filter if provided
    if (type && ["credit", "debit"].includes(type)) {
      query.type = type;
    }

    // Add date range filter if provided
    if (startDate || endDate) {
      query.time = {};
      if (startDate) query.time.$gte = new Date(startDate);
      if (endDate) query.time.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await Transaction.countDocuments(query);

    // Get transactions with pagination and sorting
    const transactions = await Transaction.find(query)
      .sort({ time: -1 }) // Sort by most recent first
      .skip(skip)
      .limit(parseInt(limit));

    // Calculate total amount for the filtered transactions
    const totalAmount = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCredit: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] 
            } 
          },
          totalDebit: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] 
            } 
          }
        }
      }
    ]);

    res.status(200).json({ 
      success: true, 
      transactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      },
      summary: {
        totalCredit: totalAmount[0]?.totalCredit || 0,
        totalDebit: totalAmount[0]?.totalDebit || 0,
        netAmount: (totalAmount[0]?.totalCredit || 0) - (totalAmount[0]?.totalDebit || 0)
      }
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error fetching transactions", 
      error: error.message 
    });
  }
});

module.exports = router;
