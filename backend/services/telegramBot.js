const axios = require('axios');
const FormData = require('form-data');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Group = require('../models/Group');
const { syncWithGoogleSheet } = require('../utils/sheetSync');
const { generateCostAnalysisPDF } = require('../utils/pdfGenerator');
const { notifyGroupMembers } = require('./notificationService');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = TELEGRAM_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_TOKEN}` : '';

let offset = 0;
let botUsername = '';

const getBotUsername = () => botUsername;

const fetchBotInfo = async () => {
  if (!TELEGRAM_API) return;
  try {
    const response = await axios.get(`${TELEGRAM_API}/getMe`);
    if (response.data && response.data.ok) {
      botUsername = response.data.result.username;
      console.log(`🤖 Telegram Bot Username: @${botUsername}`);
    }
  } catch (error) {
    console.error('Error fetching Telegram bot info:', error.message);
  }
};

// Parser function: Egg 80 food -> { itemName: 'Egg', cost: 80, categoryInput: 'food' }
const parseMessage = (text) => {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length < 3) return null;

  // Find a token that is a valid positive number representing the price.
  // Search from right to left (excluding the first and last to ensure we have item and category tokens)
  let priceIndex = -1;
  for (let i = tokens.length - 2; i >= 1; i--) {
    if (!isNaN(tokens[i]) && Number(tokens[i]) > 0) {
      priceIndex = i;
      break;
    }
  }

  // Fallback: search the entire token array for any valid positive number
  if (priceIndex === -1) {
    for (let i = 0; i < tokens.length; i++) {
      if (!isNaN(tokens[i]) && Number(tokens[i]) > 0) {
        priceIndex = i;
        break;
      }
    }
  }

  // If priceIndex is invalid or is the first/last token (meaning we lack item name or category)
  if (priceIndex === -1 || priceIndex === 0 || priceIndex === tokens.length - 1) {
    return null;
  }

  const itemName = tokens.slice(0, priceIndex).join(' ');
  const cost = Number(tokens[priceIndex]);
  const categoryInput = tokens.slice(priceIndex + 1).join(' ');

  return { itemName, cost, categoryInput };
};

// Match input to existing category list (ignoring emojis and case)
const matchCategory = (categories, input) => {
  const cleanInput = input.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!cleanInput) return null;

  // 1. Try exact match of cleaned strings
  for (const cat of categories) {
    const cleanCatName = cat.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (cleanCatName === cleanInput && cleanCatName.length > 0) {
      return cat;
    }
  }

  // 2. Try substring match (e.g. input "food" matches "Food 🍔")
  for (const cat of categories) {
    const cleanCatName = cat.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (cleanCatName.includes(cleanInput) || cleanInput.includes(cleanCatName)) {
      return cat;
    }
  }

  // 3. Try inclusion on original names
  for (const cat of categories) {
    if (cat.name.toLowerCase().includes(input.toLowerCase()) || input.toLowerCase().includes(cat.name.toLowerCase())) {
      return cat;
    }
  }

  // 4. Default fallback: Try to find a category containing 'other'
  const othersCat = categories.find(cat => cat.name.toLowerCase().includes('other'));
  return othersCat || categories[0] || null;
};

// Match group name to user's joined groups list
const matchGroup = (groups, input) => {
  const cleanInput = input.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  if (!cleanInput) return null;

  // 1. Try exact cleaned match
  for (const g of groups) {
    const cleanGroupName = g.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (cleanGroupName === cleanInput && cleanGroupName.length > 0) {
      return g;
    }
  }

  // 2. Try substring match
  for (const g of groups) {
    const cleanGroupName = g.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (cleanGroupName.includes(cleanInput) || cleanInput.includes(cleanGroupName)) {
      return g;
    }
  }

  return null;
};

// Send Markdown message to Telegram
const sendMessage = async (chatId, text, replyMarkup = null) => {
  if (!TELEGRAM_API) return;
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }
    await axios.post(`${TELEGRAM_API}/sendMessage`, payload);
  } catch (error) {
    console.error('Error sending Telegram message:', error.response?.data || error.message);
  }
};

// Send document (PDF) to Telegram
const sendDocument = async (chatId, documentBuffer, filename, caption = null) => {
  if (!TELEGRAM_API) return;
  try {
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('document', documentBuffer, {
      filename: filename,
      contentType: 'application/pdf',
    });
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'Markdown');
    }

    await axios.post(`${TELEGRAM_API}/sendDocument`, form, {
      headers: form.getHeaders(),
    });
  } catch (error) {
    console.error('Error sending Telegram document:', error.response?.data || error.message);
    throw error;
  }
};

// Helper to send report selection menu
const sendReportSelection = async (chatId, user) => {
  try {
    const userGroups = await Group.find({ members: user._id });
    const buttons = [
      [
        { text: '👤 Personal Expenses', callback_data: 'genreport:personal' }
      ]
    ];
    
    userGroups.forEach(g => {
      buttons.push([
        { text: `👥 ${g.name}`, callback_data: `genreport:${g._id.toString()}` }
      ]);
    });

    const replyMarkup = {
      inline_keyboard: buttons
    };

    await sendMessage(chatId, `📋 *Choose the report you want to download:*`, replyMarkup);
  } catch (err) {
    console.error('Error sending report selection:', err.message);
    await sendMessage(chatId, `❌ *Error:* Failed to load report options.`);
  }
};

// Helper to generate and send report PDF
const sendReportPDF = async (chatId, user, scope = 'personal') => {
  let tempMessageId = null;
  const isPersonal = scope === 'personal';
  let title = 'Personal Expenses';
  
  try {
    if (!isPersonal) {
      const group = await Group.findById(scope);
      if (group) {
        title = `Group: ${group.name}`;
      }
    }

    const tempMsgPayload = await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: `⏳ *Generating PDF Report for ${title}...* Please wait.`,
      parse_mode: 'Markdown'
    });
    tempMessageId = tempMsgPayload.data?.result?.message_id;
  } catch (err) {
    console.error('Error sending temp message:', err.message);
  }

  try {
    const pdfBuffer = await generateCostAnalysisPDF(user._id, scope);
    
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long' });
    const yearName = now.getFullYear();
    const scopeName = isPersonal ? 'Personal' : title.replace('Group: ', '').replace(/\s+/g, '_');
    const filename = `Hisab_Khata_${scopeName}_Report_${monthName}_${yearName}.pdf`;
    
    await sendDocument(
      chatId,
      pdfBuffer,
      filename,
      `📊 *Here is your ${isPersonal ? 'Personal' : 'Group'} Cost Analysis Report for ${monthName} ${yearName}!*`
    );

    if (tempMessageId) {
      await axios.post(`${TELEGRAM_API}/deleteMessage`, {
        chat_id: chatId,
        message_id: tempMessageId
      }).catch(err => console.error('Error deleting temp message:', err.message));
    }
  } catch (err) {
    console.error('Failed to send PDF report:', err.message);
    if (tempMessageId) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `❌ *Failed to generate or send report:* ${err.message}`,
        parse_mode: 'Markdown'
      }).catch(e => console.error('Error sending error message:', e.message));
    } else {
      await sendMessage(chatId, `❌ *Failed to generate or send report:* ${err.message}`);
    }
  }
};

// Answer Telegram callback queries (e.g. from inline button clicks)
const answerCallbackQuery = async (callbackQueryId, text = null) => {
  if (!TELEGRAM_API) return;
  try {
    const payload = {
      callback_query_id: callbackQueryId
    };
    if (text) {
      payload.text = text;
    }
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, payload);
  } catch (error) {
    console.error('Error answering callback query:', error.response?.data || error.message);
  }
};

// Process callback queries from inline keyboards
const handleCallbackQuery = async (callbackQuery) => {
  const callbackQueryId = callbackQuery.id;
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (!data) return;

  if (data === 'download_report') {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() });
      if (!user) {
        await answerCallbackQuery(callbackQueryId, '⚠️ Account not linked!');
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.`);
        return;
      }

      await answerCallbackQuery(callbackQueryId, '📋 Loading report options...');
      await sendReportSelection(chatId, user);
    } catch (err) {
      console.error('Error in callback query:', err.message);
      await answerCallbackQuery(callbackQueryId, '❌ Error');
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  if (data.startsWith('genreport:')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() });
      if (!user) {
        await answerCallbackQuery(callbackQueryId, '⚠️ Account not linked!');
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.`);
        return;
      }

      const scope = data.split(':')[1];
      await answerCallbackQuery(callbackQueryId, '⏳ Generating report...');
      await sendReportPDF(chatId, user, scope);
    } catch (err) {
      console.error('Error in callback query:', err.message);
      await answerCallbackQuery(callbackQueryId, '❌ Error');
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  if (data.startsWith('setgroup:')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() });
      if (!user) {
        await answerCallbackQuery(callbackQueryId, '⚠️ Account not linked!');
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.`);
        return;
      }

      const targetGroupId = data.split(':')[1];

      if (targetGroupId === 'personal') {
        user.activeTelegramGroup = null;
        await user.save();
        await answerCallbackQuery(callbackQueryId, '🎯 Reset to Personal');
        await sendMessage(chatId, `🎯 Active group session reset to *Personal* (No group).`);
      } else {
        const group = await Group.findById(targetGroupId);
        if (!group) {
          await answerCallbackQuery(callbackQueryId, '❌ Group not found');
          await sendMessage(chatId, `❌ Group not found.`);
          return;
        }

        user.activeTelegramGroup = group._id;
        await user.save();
        await answerCallbackQuery(callbackQueryId, `🎯 Set to ${group.name}`);
        await sendMessage(chatId, `🎯 Active group session set to *${group.name}*.\n\nAll subsequent expenses will be saved to this group unless you prefix with a tag or reset with \`/setgroup personal\`.`);
      }
    } catch (err) {
      console.error('Error in callback query:', err.message);
      await answerCallbackQuery(callbackQueryId, '❌ Error');
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
  }
};

// Process received Telegram messages
const handleMessage = async (message) => {
  const chatId = message.chat.id;
  const text = message.text ? message.text.trim() : '';

  if (!text) return;

  // Handle Command: /start [token]
  if (text.startsWith('/start')) {
    const parts = text.split(/\s+/);
    if (parts.length > 1) {
      const userId = parts[1];
      try {
        const user = await User.findById(userId);
        if (user) {
          user.telegramChatId = chatId.toString();
          await user.save();
          await sendMessage(chatId, `🎉 *Success!* Your Telegram account has been linked to *${user.username}* (${user.email}).\n\nYou can now send your expenses directly in this chat!\n\n*Format:* \`<Item Name> <Price> <Category>\`\n*Example:* \`Egg 80 food\``);
          return;
        }
      } catch (err) {
        console.error('Error in Telegram deep linking:', err.message);
      }
    }

    await sendMessage(chatId, `👋 *Welcome to Hisab Khata Bot!*\n\nTo log your expenses directly from Telegram, link your account first.\n\n*How to link:*\n1️⃣ Go to Hisab Khata Web App -> Settings, click "Link Telegram" or manually enter your Chat ID:\n\`${chatId}\` in the settings page.\n\nOnce linked, send messages like:\n\`Egg 80 food\`\n\`Burger 150 entertainment\``);
    return;
  }

  // Handle Command: /link
  if (text.startsWith('/link')) {
    await sendMessage(chatId, `🔒 *To link your account securely:*\n\n1. Copy this Chat ID: \`${chatId}\`\n2. Open Hisab Khata web app.\n3. Go to *Settings* -> *Account Profile*.\n4. Paste the Chat ID into the *Telegram Chat ID* field and click *Save Profile*.\n\nAlternatively, use the direct link button in your settings.`);
    return;
  }

  // Handle Command: /me
  if (text.startsWith('/me')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() }).populate('activeTelegramGroup');
      if (user) {
        let activeGroupName = 'Personal (No Group)';
        if (user.activeTelegramGroup) {
          activeGroupName = user.activeTelegramGroup.name;
        }
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: '📊 Download PDF Report', callback_data: 'download_report' }
            ]
          ]
        };
        await sendMessage(chatId, `👤 *Linked Account:*\n\n*Username:* ${user.username}\n*Email:* ${user.email}\n*Chat ID:* \`${chatId}\`\n*Active Group:* ${activeGroupName}`, replyMarkup);
      } else {
        await sendMessage(chatId, `⚠️ *Account not linked!*\nChat ID: \`${chatId}\``);
      }
    } catch (err) {
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  // Handle Command: /status or /active
  if (text.startsWith('/status') || text.startsWith('/active')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() }).populate('activeTelegramGroup');
      if (!user) {
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.\n\nType \`/link\` to learn how to link it.`);
        return;
      }

      let activeGroupName = 'Personal (No Group)';
      if (user.activeTelegramGroup) {
        activeGroupName = user.activeTelegramGroup.name;
      }

      const msg = `🤖 *Bot Status:* Online & Linked\n👤 *User:* ${user.username}\n🎯 *Active Group:* *${activeGroupName}*\n\n*Expense Entry Mode:*\n${
        user.activeTelegramGroup 
          ? `All expenses you type will go to the group *${activeGroupName}* (unless you prefix with a different group tag like \`#personal\` or another group tag).` 
          : `All expenses you type will be saved as *Personal* expenses (unless you prefix with a group tag like \`#flat\`).`
      }\n\nUse \`/setgroup\` to change the active group.`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: '📊 Download PDF Report', callback_data: 'download_report' }
          ]
        ]
      };

      await sendMessage(chatId, msg, replyMarkup);
    } catch (err) {
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  // Handle Command: /report or /download
  if (text.startsWith('/report') || text.startsWith('/download')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() });
      if (!user) {
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.\n\nType \`/link\` to learn how to link it.`);
        return;
      }

      await sendReportSelection(chatId, user);
    } catch (err) {
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  // Handle Command: /setgroup
  if (text.startsWith('/setgroup')) {
    try {
      const user = await User.findOne({ telegramChatId: chatId.toString() });
      if (!user) {
        await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.`);
        return;
      }

      const parts = text.split(/\s+/);
      const userGroups = await Group.find({ members: user._id });

      // If no group name is specified
      if (parts.length < 2) {
        // Show current active group and list available groups with inline keyboard buttons
        let activeGroupName = 'Personal (No Group)';
        if (user.activeTelegramGroup) {
          const currentGroup = await Group.findById(user.activeTelegramGroup);
          if (currentGroup) activeGroupName = currentGroup.name;
        }

        const buttons = [
          [
            { text: '👤 Personal (No Group) (#personal)', callback_data: 'setgroup:personal' }
          ]
        ];

        let msg = `🎯 *Active Group:* ${activeGroupName}\n\n*Available Groups & Tags:*\n• 👤 Personal (\`#personal\`)\n`;

        userGroups.forEach(g => {
          const cleanTagName = g.name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') || 'group';
          msg += `• 👥 ${g.name} (\`#${cleanTagName}\`)\n`;
          buttons.push([
            { text: `👥 ${g.name} (#${cleanTagName})`, callback_data: `setgroup:${g._id.toString()}` }
          ]);
        });

        const exampleTag = userGroups.length > 0 ? (userGroups[0].name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') || 'group') : 'flat';
        msg += `\nSelect a group below to set it as your default destination, or use the hashtag directly in your entry (e.g. \`#${exampleTag} Egg 80 food\`).`;

        const replyMarkup = {
          inline_keyboard: buttons
        };

        await sendMessage(chatId, msg, replyMarkup);
        return;
      }

      const targetName = parts.slice(1).join(' ').trim().toLowerCase();
      if (['personal', 'none', 'clear', 'reset', 'self'].includes(targetName)) {
        user.activeTelegramGroup = null;
        await user.save();
        await sendMessage(chatId, `🎯 Active group session reset to *Personal* (No group).`);
        return;
      }

      const matched = matchGroup(userGroups, targetName);
      if (!matched) {
        await sendMessage(chatId, `❌ Group *"${targetName}"* not found or you are not a member of it.\n\nType \`/setgroup\` to see your available groups.`);
        return;
      }

      user.activeTelegramGroup = matched._id;
      await user.save();
      await sendMessage(chatId, `🎯 Active group session set to *${matched.name}*.\n\nAll subsequent expenses will be saved to this group unless you prefix with a tag or reset with \`/setgroup personal\`.`);
    } catch (err) {
      await sendMessage(chatId, `❌ *Error:* ${err.message}`);
    }
    return;
  }

  // Process Expense Entry
  try {
    const user = await User.findOne({ telegramChatId: chatId.toString() });
    if (!user) {
      await sendMessage(chatId, `⚠️ *Account not linked!*\nYour Telegram Chat ID \`${chatId}\` is not linked to any Hisab Khata account.\n\nTo link, go to Hisab Khata Web App -> Settings and enter this Chat ID: \`${chatId}\``);
      return;
    }

    let targetGroup = null;
    let textToParse = text;
    let isExplicitPersonal = false;

    // Check for group tag (e.g. #flat Egg 80 food)
    if (text.startsWith('#')) {
      const spaceIndex = text.indexOf(' ');
      if (spaceIndex !== -1) {
        const tag = text.slice(1, spaceIndex).trim();
        textToParse = text.slice(spaceIndex + 1).trim();

        if (['personal', 'self', 'none', 'me'].includes(tag.toLowerCase())) {
          isExplicitPersonal = true;
          targetGroup = null;
        } else {
          const userGroups = await Group.find({ members: user._id });
          const matched = matchGroup(userGroups, tag);
          if (matched) {
            targetGroup = matched;
          } else {
            await sendMessage(chatId, `❌ *Error:* Group tag *#${tag}* did not match any of your groups.\n\nTransaction aborted. Please verify the group name or run \`/setgroup\` to view your groups.`);
            return;
          }
        }
      }
    }

    // If no explicit tag was matched, check user's active session group
    if (!targetGroup && !isExplicitPersonal && user.activeTelegramGroup) {
      targetGroup = await Group.findById(user.activeTelegramGroup);
    }

    const parsed = parseMessage(textToParse);
    if (!parsed) {
      await sendMessage(chatId, `❌ *Invalid format.*\n\nPlease send your expense in this format:\n\`<Item Name> <Price> <Category>\`\n\n*Examples:*\n• \`Egg 80 food\`\n• \`#flat Egg 80 food\``);
      return;
    }

    // Fetch user's categories to match the input (personal & current group categories if applicable)
    const categories = await Category.find({
      $or: [
        { user: user._id, group: null },
        { group: targetGroup ? targetGroup._id : null }
      ]
    });
    
    const matchedCategory = matchCategory(categories, parsed.categoryInput);
    const categoryName = matchedCategory ? matchedCategory.name : parsed.categoryInput;

    const transaction = new Transaction({
      user: user._id,
      itemName: parsed.itemName,
      cost: parsed.cost,
      quantity: 1,
      category: categoryName,
      date: new Date(), // Use current date/time when message is processed
      group: targetGroup ? targetGroup._id : null
    });

    await transaction.save();

    // Sync to Google Sheets in the background
    syncWithGoogleSheet(user, transaction, 'add', targetGroup).catch(err => {
      console.error('Google Sheet sync failed for telegram transaction:', err.message);
    });

    // Notify group members in the background
    if (targetGroup) {
      notifyGroupMembers(targetGroup._id, transaction, 'cost_added', user._id).catch(err => {
        console.error('Background group notification error for telegram transaction:', err.message);
      });
    }

    let successMsg = `✅ *Expense Added!*\n\n📝 *Item:* ${parsed.itemName}\n💰 *Price:* ${parsed.cost} Tk\n📁 *Category:* ${categoryName}\n📅 *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true })}`;
    if (targetGroup) {
      successMsg += `\n👥 *Group:* ${targetGroup.name}`;
    }
    
    await sendMessage(chatId, successMsg);
  } catch (err) {
    console.error('Error handling Telegram message:', err.message);
    await sendMessage(chatId, `❌ *Error processing expense:* ${err.message}`);
  }
};

// Poll Updates loop
const pollUpdates = async () => {
  if (!TELEGRAM_API) return;
  try {
    const response = await axios.get(`${TELEGRAM_API}/getUpdates`, {
      params: {
        offset: offset,
        timeout: 30
      },
      timeout: 35000
    });

    const updates = response.data.result || [];
    for (const update of updates) {
      offset = update.update_id + 1;
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      }
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.error('Telegram bot warning: Conflict. Make sure only one instance of the bot is running.');
    } else {
      console.error('Telegram bot polling error:', error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Continue polling
  setTimeout(pollUpdates, 100);
};

const setBotCommands = async () => {
  if (!TELEGRAM_API) return;
  try {
    await axios.post(`${TELEGRAM_API}/setMyCommands`, {
      commands: [
        { command: 'start', description: 'Start the bot and link your account' },
        { command: 'link', description: 'Show security instructions to link account' },
        { command: 'status', description: 'Check bot status & current active group' },
        { command: 'me', description: 'Show linked account details & active group' },
        { command: 'setgroup', description: 'Choose default group' },
        { command: 'report', description: 'Download PDF cost analysis report' }
      ]
    });
    console.log('🤖 Telegram bot commands registered successfully.');
  } catch (error) {
    console.error('Error setting Telegram bot commands:', error.response?.data || error.message);
  }
};

const startBot = async () => {
  if (!TELEGRAM_TOKEN) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN is not defined in .env. Telegram Bot service is disabled.');
    return;
  }
  await fetchBotInfo();
  await setBotCommands();
  console.log('🤖 Telegram Bot Service started. Polling for messages...');
  pollUpdates();
};

module.exports = {
  startBot,
  getBotUsername
};
