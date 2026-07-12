const axios = require('axios');

// Helper function to format date/time in 12-hour Bangladesh local timezone
const formatToBangladeshTime = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const options = {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);
  let year = '', month = '', day = '', hour = '', minute = '', second = '', dayPeriod = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'day') day = part.value;
    else if (part.type === 'hour') hour = part.value;
    else if (part.type === 'minute') minute = part.value;
    else if (part.type === 'second') second = part.value;
    else if (part.type === 'dayPeriod') dayPeriod = part.value;
  }
  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${dayPeriod}`;
};

// Helper function to sync with Google Sheet
const syncWithGoogleSheet = async (user, transaction, action, group = null) => {
  let sheetUrl = '';
  if (group && group.sheetUrl) {
    sheetUrl = group.sheetUrl;
  } else {
    sheetUrl = user.sheetUrl || process.env.GLOBAL_GOOGLE_SCRIPT_URL;
  }

  if (!sheetUrl) {
    console.log(`No sheet URL configured. Skipping sync.`);
    return { success: false, reason: 'No sheet URL configured' };
  }

  const txDate = transaction.date ? new Date(transaction.date) : new Date();
  const txMonth = transaction.date ? txDate.getUTCMonth() : txDate.getMonth();
  const txYear = transaction.date ? txDate.getUTCFullYear() : txDate.getFullYear();

  let budgetAmount = 0;
  if (group) {
    const hist = group.historicalBudgets?.find(hb => hb.month === txMonth && hb.year === txYear);
    budgetAmount = hist ? hist.amount : (group.budget || 0);
  } else {
    const hist = user.historicalBudgets?.find(hb => hb.month === txMonth && hb.year === txYear);
    budgetAmount = hist ? hist.amount : (user.budget || 0);
  }

  const payload = {
    action,
    id: transaction._id.toString(),
    name: transaction.itemName,
    cost: Number(transaction.cost),
    quantity: Number(transaction.quantity),
    category: transaction.category,
    userEmail: user.email,
    groupName: group ? group.name : 'Personal',
    date: formatToBangladeshTime(transaction.date),
    budget: budgetAmount
  };

  try {
    console.log(`Sending sync request to Google Apps Script (Action: ${action}, Group: ${payload.groupName}) for user ${user.email}...`);
    const response = await axios.post(sheetUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 8000 // 8 second timeout
    });

    if (response.data && response.data.status === 'success') {
      console.log('Google Sheet sync successful.');
      return { success: true };
    } else {
      console.error('Google Sheet sync failed:', response.data);
      return { success: false, reason: response.data ? response.data.message : 'Unknown Apps Script error' };
    }
  } catch (err) {
    console.error('Network error during Google Sheet sync:', err.message);
    return { success: false, reason: `Network error: ${err.message}` };
  }
};

module.exports = {
  formatToBangladeshTime,
  syncWithGoogleSheet
};
