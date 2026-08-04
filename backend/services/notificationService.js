const webpush = require('web-push');
const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const Group = require('../models/Group');
const User = require('../models/User');

// Configure VAPID details
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@hisabkhata.local',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log('Web Push VAPID keys successfully initialized.');
} else {
  console.warn('Web Push VAPID keys are missing. Push notifications will not be sent.');
}

/**
 * Sends a push notification to a specific subscription
 * @param {Object} subscription - Browser subscription object
 * @param {Object} payload - Notification payload
 */
const sendPush = async (subscription, payload) => {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (err) {
    // If the subscription endpoint is no longer active (410 Gone / 404 Not Found), delete it
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log(`Push subscription expired/invalid (status ${err.statusCode}). Removing endpoint:`, subscription.endpoint);
      await PushSubscription.deleteOne({ 'subscription.endpoint': subscription.endpoint });
    } else {
      console.error('Error sending web push notification:', err.message);
    }
    return { success: false, error: err.message };
  }
};

/**
 * Notifies all group members (except the sender) about a cost (added or deleted)
 * @param {string} groupId - ID of the group
 * @param {Object} transaction - Transaction details
 * @param {string} type - 'cost_added' or 'cost_deleted'
 * @param {string} senderId - ID of the user who performed the action
 */
const notifyGroupMembers = async (groupId, transaction, type = 'cost_added', senderId) => {
  try {
    const group = await Group.findById(groupId).populate('members');
    if (!group) return;

    const sender = await User.findById(senderId);
    if (!sender) return;

    // Filter out the sender from recipients
    const recipients = group.members.filter(m => m._id.toString() !== senderId.toString());
    if (recipients.length === 0) return;

    const totalCost = transaction.cost * transaction.quantity;
    const formattedCost = totalCost.toLocaleString();
    let title = '';
    let message = '';

    if (type === 'cost_added') {
      title = `New Cost in ${group.name}`;
      message = `${sender.username} added "${transaction.itemName}" costing ${formattedCost} BDT.`;
    } else if (type === 'cost_deleted') {
      title = `Cost Deleted in ${group.name}`;
      message = `${sender.username} deleted "${transaction.itemName}" (was ${formattedCost} BDT).`;
    }

    const payload = {
      notification: {
        title,
        body: message,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        vibrate: [100, 50, 100],
        data: {
          url: '/',
          groupId: group._id.toString(),
          transactionId: transaction._id ? transaction._id.toString() : null
        }
      }
    };

    // Save notifications and dispatch web pushes asynchronously
    for (const recipient of recipients) {
      // 1. Save in-app notification in DB
      await Notification.create({
        recipient: recipient._id,
        sender: sender._id,
        group: group._id,
        transaction: transaction._id || null,
        type,
        title,
        message
      });

      // 2. Send web push notification to all devices registered by this recipient
      const subscriptions = await PushSubscription.find({ user: recipient._id });
      for (const subRecord of subscriptions) {
        sendPush(subRecord.subscription, payload).catch(err => {
          console.error(`Failed to send web push to user ${recipient.username}:`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('Error in notifyGroupMembers service:', err.message);
  }
};

module.exports = {
  notifyGroupMembers,
  sendPush
};
