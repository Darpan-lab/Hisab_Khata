const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

// Generate a random unique invite code (6 characters)
const generateInviteCode = async () => {
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = await Group.findOne({ inviteCode: code });
    if (!existing) {
      isUnique = true;
    }
  }
  return code;
};

// @route   POST api/groups
// @desc    Create a new expense group
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name, sheetUrl } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Please provide a group name' });
  }

  try {
    const inviteCode = await generateInviteCode();
    const group = new Group({
      name: name.trim(),
      owner: req.user.id,
      members: [req.user.id],
      inviteCode,
      sheetUrl: sheetUrl ? sheetUrl.trim() : ''
    });

    await group.save();
    
    // Populate owner & members
    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.status(201).json({ success: true, data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error creating group' });
  }
});

// @route   GET api/groups
// @desc    Get all groups the logged-in user belongs to
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: groups.length, data: groups });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error retrieving groups' });
  }
});

// @route   POST api/groups/join
// @desc    Join an expense group via invite code
// @access  Private
router.post('/join', protect, async (req, res) => {
  const { inviteCode } = req.body;

  if (!inviteCode) {
    return res.status(400).json({ success: false, message: 'Please provide an invite code' });
  }

  try {
    const group = await Group.findOne({ inviteCode: inviteCode.trim().toUpperCase() });
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Invalid invite code. Group not found.' });
    }

    // Check if user is already a member
    if (group.members.some(memberId => memberId.toString() === req.user.id)) {
      return res.status(400).json({ success: false, message: 'You are already a member of this group' });
    }

    group.members.push(req.user.id);
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.json({ success: true, message: `Successfully joined group ${group.name}!`, data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error joining group' });
  }
});

// @route   PUT api/groups/:id
// @desc    Update group details (name, sheetUrl) - Owner only
// @access  Private
router.put('/:id', protect, async (req, res) => {
  const { name, sheetUrl } = req.body;

  try {
    let group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this group' });
    }

    if (name) group.name = name.trim();
    if (sheetUrl !== undefined) group.sheetUrl = sheetUrl.trim();

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.json({ success: true, data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error updating group' });
  }
});

// @route   POST api/groups/:id/leave
// @desc    Leave a group (non-owner only)
// @access  Private
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if user is the owner
    if (group.owner.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Owner cannot leave the group. You must delete the group instead.' });
    }

    // Check if user is a member
    if (!group.members.some(memberId => memberId.toString() === req.user.id)) {
      return res.status(400).json({ success: false, message: 'You are not a member of this group' });
    }

    // Remove member
    group.members = group.members.filter(memberId => memberId.toString() !== req.user.id);
    await group.save();

    res.json({ success: true, message: 'You have left the group successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error leaving group' });
  }
});

// @route   DELETE api/groups/:id
// @desc    Delete a group and its associated transactions (Owner only)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this group' });
    }

    // Delete all transactions associated with this group
    await Transaction.deleteMany({ group: group._id });

    // Delete group
    await group.deleteOne();

    res.json({ success: true, message: 'Group and its associated transactions deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error deleting group' });
  }
});

// @route   DELETE api/groups/:id/members/:memberId
// @desc    Remove a member from a group (Owner only)
// @access  Private
router.delete('/:id/members/:memberId', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if logged-in user is the owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage members of this group' });
    }

    const memberToRemove = req.params.memberId;

    // Owner cannot remove themselves
    if (memberToRemove === group.owner.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot remove yourself (the owner) from the group.' });
    }

    // Check if user is a member
    if (!group.members.some(m => m.toString() === memberToRemove)) {
      return res.status(400).json({ success: false, message: 'User is not a member of this group' });
    }

    // Remove member
    group.members = group.members.filter(m => m.toString() !== memberToRemove);
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.json({ success: true, message: 'Member removed successfully', data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error removing member' });
  }
});

// @route   POST api/groups/:id/regenerate-invite
// @desc    Regenerate a new invitation code for the group (Owner only)
// @access  Private
router.post('/:id/regenerate-invite', protect, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if owner
    if (group.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to change settings for this group' });
    }

    const inviteCode = await generateInviteCode();
    group.inviteCode = inviteCode;
    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.json({ success: true, message: 'Invitation code regenerated successfully', data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error regenerating invite code' });
  }
});

// @route   PUT api/groups/:id/budget
// @desc    Set group total budget (Any member can set)
// @access  Private
router.put('/:id/budget', protect, async (req, res) => {
  const { budget, month, year } = req.body;

  if (budget === undefined || isNaN(Number(budget))) {
    return res.status(400).json({ success: false, message: 'Please provide a valid budget value' });
  }

  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    // Check if user is a member of the group
    if (!group.members.some(memberId => memberId.toString() === req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to set budget for this group' });
    }

    const now = new Date();
    const targetMonth = month !== undefined ? Number(month) : now.getMonth();
    const targetYear = year !== undefined ? Number(year) : now.getFullYear();

    if (targetMonth === now.getMonth() && targetYear === now.getFullYear()) {
      group.budget = Number(budget);
    }

    const existingHistIndex = group.historicalBudgets.findIndex(
      hb => hb.month === targetMonth && hb.year === targetYear
    );
    if (existingHistIndex > -1) {
      group.historicalBudgets[existingHistIndex].amount = Number(budget);
    } else {
      group.historicalBudgets.push({
        month: targetMonth,
        year: targetYear,
        amount: Number(budget)
      });
    }

    await group.save();

    const populatedGroup = await Group.findById(group._id)
      .populate('owner', 'username email profilePic')
      .populate('members', 'username email profilePic');

    res.json({ success: true, message: 'Group budget updated successfully', data: populatedGroup });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server error updating budget' });
  }
});

module.exports = router;
