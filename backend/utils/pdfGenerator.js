const PDFDocument = require('pdfkit');
const User = require('../models/User');
const Group = require('../models/Group');
const Transaction = require('../models/Transaction');

/**
 * Strips emojis and special symbols that PDFKit default Helvetica font cannot render.
 */
const cleanText = (str) => {
  if (typeof str !== 'string') return '';
  // Remove emojis, symbols, and non-latin common emoji ranges
  return str.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '').trim();
};

/**
 * Generates a PDF Report containing Cost Analysis for personal or group costs.
 * @param {string} userId - The ID of the user.
 * @param {string|null} groupId - The ID of the group, or 'personal' / null.
 * @returns {Promise<Buffer>} - A promise that resolves to the PDF buffer.
 */
const generateCostAnalysisPDF = async (userId, groupId = null, customMonth = null, customYear = null) => {
  // Fetch User
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const isPersonal = !groupId || groupId === 'personal';
  let targetGroup = null;

  if (!isPersonal) {
    targetGroup = await Group.findById(groupId).populate('members', 'username email');
    if (!targetGroup) {
      throw new Error('Group not found');
    }
    // Check if user is a member of the group
    if (!targetGroup.members.some(member => member._id.toString() === userId.toString())) {
      throw new Error('Not authorized to access this group');
    }
  }

  // Time Window: Target Month (defaults to Current Month)
  const now = new Date();
  const hasCustomMonth = customMonth !== null && customMonth !== undefined && customMonth !== '';
  const hasCustomYear = customYear !== null && customYear !== undefined && customYear !== '';
  const targetMonth = hasCustomMonth ? Number(customMonth) : now.getMonth();
  const targetYear = hasCustomYear ? Number(customYear) : now.getFullYear();

  const startOfMonth = new Date(targetYear, targetMonth, 1);
  const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

  const monthDate = new Date(targetYear, targetMonth, 1);
  const monthName = monthDate.toLocaleString('default', { month: 'long' });
  const yearName = targetYear;

  // Fetch relevant transactions in the current month
  let transactions;
  if (isPersonal) {
    const linkedGroupIds = Array.isArray(user.linkedPersonalGroups) ? user.linkedPersonalGroups : [];
    transactions = await Transaction.find({
      $or: [
        { group: null, user: userId },
        { group: { $in: linkedGroupIds }, user: userId }
      ],
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('user', 'username email').populate('group', 'name');
  } else {
    transactions = await Transaction.find({
      group: groupId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    }).populate('user', 'username email');
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, autoFirstPage: true, bufferPages: true });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });
    doc.on('error', (err) => {
      reject(err);
    });

    // Color Palette
    const primaryColor = '#4f46e5';   // Indigo
    const secondaryColor = '#1f2937'; // Dark gray
    const mutedColor = '#6b7280';     // Gray
    const successColor = '#10b981';   // Emerald
    const dangerColor = '#ef4444';    // Red
    const lightBg = '#f3f4f6';        // Light gray
    const gridBorderColor = '#e5e7eb';

    // Helper: Header design
    const drawHeader = () => {
      // Top accent bar
      doc.rect(0, 0, doc.page.width, 15).fill(primaryColor);
      
      // Title
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(24).text('Hisab Khata', 50, 40);
      
      const subtitle = isPersonal 
        ? 'Personal Expense Report & Cost Analysis' 
        : `Group Report & Cost Analysis: ${cleanText(targetGroup.name)}`;
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(12).text(subtitle, 50, 70);
      
      // Date info
      doc.fillColor(mutedColor).font('Helvetica').fontSize(9).text(`Generated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' })} (Dhaka Time)`, 50, 90);
      doc.text(`Reporting Period: ${monthName} ${yearName}`, 50, 105);

      // User/Group details box
      doc.rect(350, 40, 210, 80).fill(lightBg);
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text(isPersonal ? 'Prepared For:' : 'Group Details:', 360, 50);
      if (isPersonal) {
        doc.font('Helvetica').fontSize(9).text(`Username: ${cleanText(user.username)}`, 360, 65, { width: 190 });
        doc.text(`Email: ${cleanText(user.email)}`, 360, 80, { width: 190 });
        doc.text(`Scope: Personal Expenses`, 360, 95);
      } else {
        doc.font('Helvetica').fontSize(9).text(`Group Name: ${cleanText(targetGroup.name)}`, 360, 65, { width: 190 });
        doc.text(`Members Count: ${targetGroup.members.length}`, 360, 80, { width: 190 });
        doc.text(`Requestor: ${cleanText(user.username)}`, 360, 95);
      }

      doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, 140).lineTo(560, 140).stroke();
    };

    drawHeader();
    let y = 160;

    // Helper: Draw Section Title
    const drawSectionHeader = (title) => {
      if (y > 650) {
        doc.addPage();
        drawHeader();
        y = 160;
      }
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13).text(title, 50, y);
      y += 20;
      doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, y).lineTo(560, y).stroke();
      y += 15;
    };

    if (isPersonal) {
      // 1. Personal Cost Analysis
      drawSectionHeader('1. Personal Expense Summary');

      // Aggregate Personal Expenses
      let personalTotal = 0;
      const personalCategoryMap = {};
      transactions.forEach(t => {
        const amount = t.cost * (t.quantity || 1);
        personalTotal += amount;
        if (t.group) {
          personalCategoryMap['Shared Cost'] = (personalCategoryMap['Shared Cost'] || 0) + amount;
        } else {
          personalCategoryMap[t.category] = (personalCategoryMap[t.category] || 0) + amount;
        }
      });

      const isCurrent = (targetMonth === now.getMonth()) && (targetYear === now.getFullYear());
      const budget = isCurrent 
        ? (user.budget || 0) 
        : (user.historicalBudgets?.find(hb => hb.month === targetMonth && hb.year === targetYear)?.amount ?? (user.budget || 0));
      const budgetStatus = budget > 0 
        ? (personalTotal > budget ? 'Over Budget' : 'Within Budget') 
        : 'No Budget Set';

      // Info cards for Budget & Spent
      doc.rect(50, y, 160, 60).fill(lightBg);
      doc.fillColor(mutedColor).font('Helvetica-Bold').fontSize(9).text('MONTHLY BUDGET', 60, y + 15);
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(14).text(`${budget.toLocaleString()} Tk`, 60, y + 30);

      doc.rect(220, y, 160, 60).fill(lightBg);
      doc.fillColor(mutedColor).font('Helvetica-Bold').fontSize(9).text('TOTAL SPENT', 230, y + 15);
      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(14).text(`${personalTotal.toLocaleString()} Tk`, 230, y + 30);

      doc.rect(390, y, 170, 60).fill(lightBg);
      doc.fillColor(mutedColor).font('Helvetica-Bold').fontSize(9).text('BUDGET STATUS', 400, y + 15);
      
      let statusColor = secondaryColor;
      if (budgetStatus === 'Within Budget') statusColor = successColor;
      if (budgetStatus === 'Over Budget') statusColor = dangerColor;
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(13).text(budgetStatus, 400, y + 30);
      if (budget > 0) {
        const diff = Math.abs(budget - personalTotal);
        doc.fillColor(mutedColor).font('Helvetica').fontSize(8).text(
          personalTotal > budget ? `${diff.toLocaleString()} Tk exceeded` : `${diff.toLocaleString()} Tk remaining`,
          400, y + 46
        );
      }

      y += 85;

      // Draw Category Breakdown for Personal
      if (Object.keys(personalCategoryMap).length > 0) {
        if (y > 680) {
          doc.addPage();
          drawHeader();
          y = 160;
        }
        doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(11).text('Personal Spend by Category:', 50, y);
        y += 15;

        const headers = ['Category', 'Total Spent (Tk)', 'Percentage'];
        const rows = Object.entries(personalCategoryMap)
          .sort((a, b) => b[1] - a[1])
          .map(([category, amount]) => [
            cleanText(category),
            amount.toLocaleString(),
            `${((amount / (personalTotal || 1)) * 100).toFixed(1)}%`
          ]);
        
        const colWidths = [200, 150, 160];
        y = drawTable(doc, headers, rows, 50, y, colWidths);
        y += 20;
      } else {
        doc.fillColor(mutedColor).font('Helvetica-Oblique').fontSize(10).text('No personal expenses logged in this month.', 50, y);
        y += 20;
      }
    } else {
      // 2. Group Cost Analysis
      drawSectionHeader(`1. Group Expense Summary: ${cleanText(targetGroup.name)}`);

      // Group Aggregates
      let groupTotal = 0;
      let userContribution = 0;
      const groupCategoryMap = {};
      const memberSpentMap = {};

      // Initialize member spent mapping
      targetGroup.members.forEach(m => {
        memberSpentMap[m._id.toString()] = { username: cleanText(m.username), spent: 0 };
      });

      transactions.forEach(t => {
        const amount = t.cost * (t.quantity || 1);
        groupTotal += amount;
        
        const category = t.category;
        groupCategoryMap[category] = (groupCategoryMap[category] || 0) + amount;

        const payerId = t.user ? (t.user._id ? t.user._id.toString() : t.user.toString()) : 'unknown';
        if (!memberSpentMap[payerId]) {
          memberSpentMap[payerId] = { username: cleanText(t.user && t.user.username) || 'Unknown', spent: 0 };
        }
        memberSpentMap[payerId].spent += amount;

        if (payerId === userId.toString()) {
          userContribution += amount;
        }
      });

      // Show Group statistics in key-value list format or small grid
      const isCurrentGroupPeriod = (targetMonth === now.getMonth()) && (targetYear === now.getFullYear());
      const groupBudget = isCurrentGroupPeriod 
        ? (targetGroup.budget || 0) 
        : (targetGroup.historicalBudgets?.find(hb => hb.month === targetMonth && hb.year === targetYear)?.amount ?? (targetGroup.budget || 0));

      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(9).text('Group Budget:', 50, y);
      doc.font('Helvetica').fontSize(9).text(`${groupBudget.toLocaleString()} Tk`, 150, y);
      
      doc.font('Helvetica-Bold').fontSize(9).text('Total Group Spent:', 280, y);
      doc.font('Helvetica').fontSize(9).text(`${groupTotal.toLocaleString()} Tk`, 380, y);

      y += 15;
      
      doc.font('Helvetica-Bold').fontSize(9).text('Your Contribution:', 50, y);
      doc.font('Helvetica').fontSize(9).text(`${userContribution.toLocaleString()} Tk`, 150, y);
      
      // Show share estimate (even split)
      const memberCount = targetGroup.members.length || 1;
      const fairShare = groupTotal / memberCount;
      doc.font('Helvetica-Bold').fontSize(9).text('Individual Share:', 280, y);
      doc.font('Helvetica').fontSize(9).text(`${fairShare.toFixed(1)} Tk / member`, 380, y);

      y += 20;

      // Draw Member Spend Comparison Table
      if (y > 650) {
        doc.addPage();
        drawHeader();
        y = 160;
      }

      doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text('Members Contribution & Balances:', 50, y);
      y += 12;

      const groupMembersHeaders = ['Member Name', 'Total Spent (Tk)', 'Net Balance'];
      const groupMembersRows = Object.values(memberSpentMap).map(m => {
        const netBalance = m.spent - fairShare;
        const netStr = netBalance > 0 
          ? `+${netBalance.toFixed(1)} (Receives)` 
          : `${netBalance.toFixed(1)} (Owes)`;
        return [cleanText(m.username), m.spent.toLocaleString(), netStr];
      });

      y = drawTable(doc, groupMembersHeaders, groupMembersRows, 50, y, [200, 150, 160]);
      y += 15;

      // Draw Category Breakdown for Group
      if (Object.keys(groupCategoryMap).length > 0) {
        if (y > 650) {
          doc.addPage();
          drawHeader();
          y = 160;
        }
        doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(10).text('Category Breakdown:', 50, y);
        y += 12;
        
        const gCatHeaders = ['Category', 'Total Spent (Tk)', 'Percentage'];
        const gCatRows = Object.entries(groupCategoryMap)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => [
            cleanText(cat),
            amt.toLocaleString(),
            `${((amt / (groupTotal || 1)) * 100).toFixed(1)}%`
          ]);
        y = drawTable(doc, gCatHeaders, gCatRows, 50, y, [200, 150, 160]);
        y += 25;
      } else {
        y += 10;
      }
    }

    // 3. Recent Transactions Log (Last 15 overall)
    if (y > 600) {
      doc.addPage();
      drawHeader();
      y = 160;
    }

    drawSectionHeader('2. Recent Expenses Log (Current Month)');

    let reportLogItems = [];
    if (isPersonal) {
      const purePersonalTxs = transactions.filter(t => !t.group);

      // Consolidate shared group expenses: NO individual shared cost entries, just group name and total cost!
      const groupMap = {};
      transactions.filter(t => t.group).forEach(t => {
        const gid = t.group._id ? t.group._id.toString() : t.group.toString();
        const gName = cleanText(t.group.name || 'Shared Group');
        if (!groupMap[gid]) {
          groupMap[gid] = {
            groupName: gName,
            totalCost: 0,
            latestDate: t.date
          };
        }
        groupMap[gid].totalCost += t.cost * (t.quantity || 1);
        if (new Date(t.date) > new Date(groupMap[gid].latestDate)) {
          groupMap[gid].latestDate = t.date;
        }
      });

      const consolidatedGroupEntries = Object.values(groupMap).map(g => ({
        date: g.latestDate,
        itemName: g.groupName, // just group name
        cost: g.totalCost, // total cost
        category: 'Shared Cost'
      }));

      reportLogItems = [
        ...purePersonalTxs.map(t => ({
          date: t.date,
          itemName: cleanText(t.itemName),
          cost: t.cost * (t.quantity || 1),
          category: cleanText(t.category)
        })),
        ...consolidatedGroupEntries
      ].sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      reportLogItems = transactions
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => ({
          date: t.date,
          itemName: cleanText(t.itemName),
          cost: t.cost * (t.quantity || 1),
          category: cleanText(t.category),
          payer: t.user ? cleanText(t.user.username) : 'Unknown'
        }));
    }

    if (reportLogItems.length > 0) {
      const logHeaders = isPersonal
        ? ['Date', 'Item Name', 'Cost (Tk)', 'Category']
        : ['Date', 'Item Name', 'Cost (Tk)', 'Category', 'Paid By'];
      
      const logRows = reportLogItems
        .slice(0, 20) // Limit to top 20 for brief report styling
        .map(item => {
          const dateStr = new Date(item.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
          return isPersonal
            ? [dateStr, item.itemName, item.cost.toLocaleString(), item.category]
            : [dateStr, item.itemName, item.cost.toLocaleString(), item.category, item.payer];
        });

      const logColWidths = isPersonal ? [80, 200, 100, 130] : [65, 155, 75, 100, 115];
      y = drawTable(doc, logHeaders, logRows, 50, y, logColWidths);
    } else {
      doc.fillColor(mutedColor).font('Helvetica-Oblique').fontSize(10).text('No transactions found in this month.', 50, y);
      y += 15;
    }

    // Footer page number stamp helper
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor(mutedColor).font('Helvetica').fontSize(8)
        .text(`Page ${i + 1} of ${pageCount}  |  Hisab Khata Expense Tracker`, 50, 755, { align: 'center', width: 512 });
    }

    doc.end();
  });
};

/**
 * Custom table drawer since PDFKit doesn't have table elements built-in.
 */
const drawTable = (doc, headers, rows, startX, startY, colWidths) => {
  let y = startY;
  const primaryColor = '#4f46e5';
  const secondaryColor = '#1f2937';
  const gridBorderColor = '#e5e7eb';

  // Draw Header background
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  doc.rect(startX, y, totalWidth, 18).fill('#f3f4f6');
  
  // Header text
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(secondaryColor);
  headers.forEach((header, index) => {
    const x = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0) + 5;
    doc.text(header, x, y + 5, { width: colWidths[index] - 10, align: 'left' });
  });
  
  y += 18;
  // Border line
  doc.strokeColor(primaryColor).lineWidth(1).moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
  y += 3;
  
  // Rows
  doc.font('Helvetica').fontSize(8).fillColor('#374151');
  rows.forEach((row, rowIndex) => {
    if (y > 720) {
      doc.addPage();
      y = 50; // top margin on new page
      
      // Re-draw headers on new page
      doc.rect(startX, y, totalWidth, 18).fill('#f3f4f6');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(secondaryColor);
      headers.forEach((header, index) => {
        const x = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0) + 5;
        doc.text(header, x, y + 5, { width: colWidths[index] - 10, align: 'left' });
      });
      y += 18;
      doc.strokeColor(primaryColor).lineWidth(1).moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
      y += 3;
      doc.font('Helvetica').fontSize(8).fillColor('#374151');
    }
    
    // Alternating rows shading
    if (rowIndex % 2 === 1) {
      doc.rect(startX, y, totalWidth, 16).fill('#f9fafb');
    }

    row.forEach((cell, index) => {
      const x = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0) + 5;
      doc.fillColor('#374151').text(cell.toString(), x, y + 4, { width: colWidths[index] - 10, align: 'left' });
    });
    
    y += 16;
    // Row separator line
    doc.strokeColor(gridBorderColor).lineWidth(0.5).moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
  });
  
  return y + 5;
};

module.exports = {
  generateCostAnalysisPDF
};
