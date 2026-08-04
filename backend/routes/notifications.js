const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');

// @route   GET api/notifications/vapid-key
// @desc    Get the server's public VAPID key
// @access  Private
router.get('/vapid-key', protect, (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(500).json({ success: false, message: 'VAPID keys not configured on server' });
  }
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY });
});

// @route   POST api/notifications/subscribe
// @desc    Subscribe user device to push notifications
// @access  Private
router.post('/subscribe', protect, async (req, res) => {
  const { subscription } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ success: false, message: 'Invalid subscription object' });
  }

  try {
    // Save or update subscription (using endpoint as the unique identifier per client device)
    await PushSubscription.findOneAndUpdate(
      { 'subscription.endpoint': subscription.endpoint },
      {
        user: req.user.id,
        subscription
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Successfully subscribed to push notifications' });
  } catch (err) {
    console.error('Error saving push subscription:', err.message);
    res.status(500).json({ success: false, message: 'Server Error saving subscription' });
  }
});

// @route   POST api/notifications/unsubscribe
// @desc    Unsubscribe user device from push notifications
// @access  Private
router.post('/unsubscribe', protect, async (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ success: false, message: 'Endpoint is required' });
  }

  try {
    await PushSubscription.deleteOne({
      user: req.user.id,
      'subscription.endpoint': endpoint
    });

    res.json({ success: true, message: 'Successfully unsubscribed from push notifications' });
  } catch (err) {
    console.error('Error deleting push subscription:', err.message);
    res.status(500).json({ success: false, message: 'Server Error unsubscribing' });
  }
});

// @route   GET api/notifications
// @desc    Get user's in-app notifications
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'username email profilePic')
      .populate('group', 'name');

    res.json({ success: true, data: notifications });
  } catch (err) {
    console.error('Error fetching notifications:', err.message);
    res.status(500).json({ success: false, message: 'Server Error fetching notifications' });
  }
});

// @route   PUT api/notifications/read
// @desc    Mark specific or all notifications as read
// @access  Private
router.put('/read', protect, async (req, res) => {
  const { notificationId } = req.body;

  try {
    if (notificationId) {
      // Mark a single notification as read
      await Notification.updateOne(
        { _id: notificationId, recipient: req.user.id },
        { isRead: true }
      );
    } else {
      // Mark all notifications for the user as read
      await Notification.updateMany(
        { recipient: req.user.id, isRead: false },
        { isRead: true }
      );
    }

    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Error updating notifications status:', err.message);
    res.status(500).json({ success: false, message: 'Server Error updating notifications' });
  }
});

// @route   DELETE api/notifications
// @desc    Clear all notifications for user
// @access  Private
router.delete('/', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.id });
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (err) {
    console.error('Error clearing notifications:', err.message);
    res.status(500).json({ success: false, message: 'Server Error clearing notifications' });
  }
});

module.exports = router;
