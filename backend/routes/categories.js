const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Group = require('../models/Group');
const { protect } = require('../middleware/auth');

// @route   GET api/categories
// @desc    Get all categories for logged-in user (personal + joined groups)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const userGroups = await Group.find({ members: req.user.id });
    const groupIds = userGroups.map(g => g._id);

    const categories = await Category.find({
      $or: [
        { user: req.user.id, group: null },
        { group: { $in: groupIds } }
      ]
    }).sort({ name: 1 });

    res.json({ success: true, count: categories.length, data: categories });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error fetching categories' });
  }
});

// @route   POST api/categories
// @desc    Create a new custom category (personal or group-scoped)
// @access  Private
router.post('/', protect, async (req, res) => {
  const { name, color, group: groupId } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Please provide a category name' });
  }

  try {
    let existing;
    if (groupId) {
      // Group scope
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

      // Check if user is the creator of the group
      if (group.owner.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Only the group creator can create custom categories for their group' });
      }

      // Check if category name already exists for this group
      existing = await Category.findOne({
        group: groupId,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
    } else {
      // Personal scope
      existing = await Category.findOne({
        user: req.user.id,
        group: null,
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
      });
    }

    if (existing) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const category = new Category({
      name: name.trim(),
      color: color || '#6366f1',
      user: req.user.id,
      group: groupId || null,
      isDefault: false
    });

    await category.save();

    res.status(201).json({ success: true, data: category });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error creating category' });
  }
});

// @route   DELETE api/categories/:id
// @desc    Delete a category
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (category.group) {
      const group = await Group.findById(category.group);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

      // Check if user is group creator
      if (group.owner.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Only the group creator can delete custom categories for their group' });
      }
    } else {
      // Personal category check
      if (category.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this category' });
      }
    }

    await category.deleteOne();

    res.json({ success: true, message: 'Category removed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server Error deleting category' });
  }
});

module.exports = router;
