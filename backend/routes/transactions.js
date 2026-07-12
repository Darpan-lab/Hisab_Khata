const express = require('express');
const router = express.Router();
const axios = require('axios');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');

const { syncWithGoogleSheet } = require('../utils/sheetSync');
const { generateCostAnalysisPDF } = require('../utils/pdfGenerator');


// @route   GET api/transactions/report/pdf
// @desc    Download PDF report of cost analysis (personal or group)
// @access  Private
router.get('/report/pdf', protect, async (req, res) => {
  const { groupId } = req.query;

  try {
    const pdfBuffer = await generateCostAnalysisPDF(req.user.id, groupId);

    let filename = 'Personal_Report.pdf';
    if (groupId && groupId !== 'personal') {
      const group = await Group.findById(groupId);
      if (group) {
        filename = `${group.name.replace(/\s+/g, '_')}_Report.pdf`;
      }
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating PDF endpoint:', err.message);
    res.status(500).json({ success: false, message: `Failed to generate PDF: ${err.message}` });
  }
});

// @route   GET api/transactions
// @desc    Get all transactions for logged-in user (personal & joined groups)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // Find all groups the user is a member of
    const userGroups = await Group.find({ members: req.user.id });
    const groupIds = userGroups.map(g => g._id);

    // Fetch transactions that are personal OR belong to any group the user is in
    const transactions = await Transaction.find({
      $or: [
        { group: null, user: req.user.id },
        { group: { $in: groupIds } }
      ]
    })
    .sort({ date: -1, createdAt: -1 })
    .populate('user', 'username email profilePic')
    .populate('group', 'name sheetUrl owner');

    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error fetching transactions' });
  }
});

// @route   POST api/transactions
// @desc    Create a new transaction & sync to Google Sheet
// @access  Private
router.post('/', protect, async (req, res) => {
  const { itemName, cost, quantity, category, date, groupId } = req.body;

  if (!itemName || cost === undefined || !category) {
    return res.status(400).json({ success: false, message: 'Please include itemName, cost, and category' });
  }

  try {
    let group = null;
    if (groupId) {
      group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      
      // Check if user is a member of the group
      if (!group.members.some(memberId => memberId.toString() === req.user.id)) {
        return res.status(403).json({ success: false, message: 'Not authorized to add transactions to this group' });
      }
    }

    // Create transaction in MongoDB
    const transaction = new Transaction({
      itemName: itemName.trim(),
      cost: Number(cost),
      quantity: quantity ? Number(quantity) : 1,
      category: category.trim(),
      date: (() => {
        if (date) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const [yr, mo, dy] = date.split('-').map(Number);
            const now = new Date();
            const formatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Dhaka',
              hour: 'numeric',
              minute: 'numeric',
              second: 'numeric',
              fractionalSecondDigits: 3,
              hour12: false
            });
            const parts = formatter.formatToParts(now);
            const comps = {};
            for (const part of parts) {
              comps[part.type] = part.value;
            }
            const hr = Number(comps.hour) || 0;
            const min = Number(comps.minute) || 0;
            const sec = Number(comps.second) || 0;
            const ms = Number(comps.fractionalSecond) || 0;

            // Asia/Dhaka is UTC+6
            const utcMillis = Date.UTC(yr, mo - 1, dy, hr, min, sec, ms);
            return new Date(utcMillis - (6 * 60 * 60 * 1000));
          }
          return new Date(date);
        }
        return new Date();
      })(),
      user: req.user.id,
      group: groupId || null
    });

    await transaction.save();

    // Fetch full user object to get their email and personal sheetUrl
    const user = await User.findById(req.user.id);
    
    // Sync to Google Sheet in the background
    syncWithGoogleSheet(user, transaction, 'add', group).catch(err => {
      console.error('Background Google Sheet sync error:', err.message);
    });

    // Populate transaction before sending back
    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('user', 'username email profilePic')
      .populate('group', 'name sheetUrl owner');

    res.status(201).json({
      success: true,
      data: populatedTransaction
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error creating transaction' });
  }
});

// @route   DELETE api/transactions/:id
// @desc    Delete a transaction & sync removal to Google Sheet
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    let group = null;
    if (transaction.group) {
      group = await Group.findById(transaction.group);
      if (!group) {
        // Group no longer exists, but we should let user delete their transaction if they created it
        if (transaction.user.toString() !== req.user.id) {
          return res.status(403).json({ success: false, message: 'Not authorized to delete this transaction' });
        }
      } else {
        // Group exists: transaction creator or group owner can delete
        const isCreator = transaction.user.toString() === req.user.id;
        const isGroupOwner = group.owner.toString() === req.user.id;
        if (!isCreator && !isGroupOwner) {
          return res.status(403).json({ success: false, message: 'Only the transaction creator or group owner can delete it' });
        }
      }
    } else {
      // Personal transaction: creator can delete
      if (transaction.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this transaction' });
      }
    }

    // Fetch full user object (the deleting user, or transaction creator to get correct email)
    // We'll use the transaction creator's details for sheet sync consistency if possible
    const transactionCreator = await User.findById(transaction.user);
    
    // Sync deletion to Google Sheet in the background
    syncWithGoogleSheet(transactionCreator || req.user, transaction, 'delete', group).catch(err => {
      console.error('Background Google Sheet deletion sync error:', err.message);
    });

    // Remove from MongoDB
    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error deleting transaction' });
  }
});

module.exports = router;
