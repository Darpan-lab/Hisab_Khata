# Hisab Khata 📱💰
### Simple, Smart Budgeting & Group Expense Tracker

**Hisab Khata** is a lightweight, mobile-friendly budget and expense tracker designed to take the stress out of daily money management. Whether you're tracking your personal everyday spending, splitting monthly groceries with flatmates, or managing a group trip with friends, Hisab Khata makes it fast, easy, and reliable.

It syncs in real time with **Google Sheets**, works **100% offline**, and even lets you log expenses on the fly through a personal **Telegram Bot**!

---

## ✨ Key Features You'll Love

### 👥 1. Group Shared Expenses & Bill Splitting
No more messy calculators or arguing about who paid for what at the end of the month:
* **Create Custom Groups**: Perfect for roommates, bachelor mess bills, trips, family budgets, or office lunches.
* **Track Individual Member Spending**: Instantly see who spent what today and throughout the month.
* **Group Budgets**: Set a monthly budget for the entire group so everyone knows how much balance is left before overspending.
* **Flexible Cost Sharing**: Log an expense to a group and optionally reflect it in your own personal budget (*"Share with personal costing"*).
* **Multi-Select Calculation**: In your history tab, tap items to select them and get an instant real-time total of selected expenses.

---

### 📊 2. Automatic Google Sheets Sync
Keep full ownership of your financial records in your own Google Drive:
* **Zero Manual Copy-Pasting**: Every time you add or delete an expense in the app or via Telegram, your Google Sheet updates immediately.
* **Organized Monthly Tabs**: Automatically creates a separate tab for each month (e.g., `2026-11`, `2026-12`) so your records stay neat and tidy.
* **Auto Summary Formulas**: Includes built-in formulas for total budget, total spent, and remaining balance right inside your spreadsheet.

---

### 🤖 3. Fast Telegram Bot Assistant
Too busy to open an app while shopping? Just text your Telegram bot:
* **Log in 3 Seconds**: Send a short message like `Egg 80 food` or `Coffee 150 snacks`. The bot logs the item, cost, and category into the database and your Google Sheet instantly.
* **Group Tagging via Hashtags**: Log directly to any group by prefixing the name, like `#flat Milk 60 Food`, or use `#personal` for yourself.
* **Smart Commands**:
  * `/setgroup` - Pick a default group so all your quick messages go straight to that group.
  * `/report` - Get a downloadable PDF summary sent directly to your chat.
  * `/status` - Check your active account and current group scope.

---

### 📶 4. Works Completely Offline (PWA)
Never worry about spotty internet or weak network signals:
* **Log Anytime, Anywhere**: Even with zero connection, you can open the app and log expenses.
* **Automatic Background Sync**: Entries are stored safely on your device (IndexedDB) and sync to the cloud as soon as you reconnect.
* **Install on Your Phone**: Built as a Progressive Web App (PWA). You can install it on your iOS or Android home screen with no app store download required.
* **Smooth Gestures**: Swipe left and right between tabs (*Track*, *History*, *Groups*, *Settings*) with native mobile app responsiveness.

---

### 📈 5. Visual Insights & One-Click Exports
* **Quick Dashboard Stats**: See today's spending, this month's total, and your remaining budget at a single glance.
* **Custom Categories**: Add your own custom spending categories with personalized colors.
* **Export PDF & CSV**: Download professional PDF reports or CSV spreadsheets for both personal and group spending anytime.
* **Dark & Light Mode**: Switch seamlessly between a clean light mode and an eye-friendly dark mode.

---

### 🛡️ 6. Private & Self-Host Ready
* **Dynamic First-User Admin**: The first person to sign up on a fresh installation automatically becomes the Administrator.
* **Admin Controls**: View registered users and pause new signups if you want to keep your instance private for just yourself, your family, or your friends.

---

## 🧭 How It Works Day to Day

```
               ┌───────────────────────┐
               │      Hisab Khata      │
               │   Mobile / Web App    │
               └───────────┬───────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │  Personal Mode  │         │   Group Mode    │
    │  Daily expenses │         │ Roommates / Trip│
    └────────┬────────┘         └────────┬────────┘
             │                           │
             └─────────────┬─────────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
      ┌────────────┐ ┌───────────┐ ┌────────────┐
      │  MongoDB   │ │  Google   │ │  Telegram  │
      │  Database  │ │  Sheets   │ │    Bot     │
      └────────────┘ └───────────┘ └────────────┘
```

1. **Open the App**: Hit the **Track** tab to add an expense in seconds.
2. **Choose Scope**: Keep it personal, or select a group to split with others.
3. **Review**: Check the **History** tab to filter by category or date, or jump to **Groups** to see who owes what.
4. **Relax**: Everything is already backed up to your Google Sheet!

---

## 🚀 Quick Setup & Installation

You can run Hisab Khata on your local machine or deploy it to a Linux server (Ubuntu/Debian).

### Prerequisites
* **Node.js** (v18 or higher)
* **MongoDB** (running locally or a free cloud cluster from [MongoDB Atlas](https://www.mongodb.com/atlas))
* **Git**

---

### 1. Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/hisab-khata.git
cd hisab-khata

# Install dependencies for both backend and frontend
npm run install-all
```

---

### 2. Configure Environment Variables

Navigate to the `backend/` folder and create your `.env` file:

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in your details:

```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/hisab_khata
JWT_SECRET=your_super_secret_random_key_here

# Optional: Telegram bot token if you want Telegram logging
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Optional: Default Google Apps Script URL (users can also set this in the UI)
GLOBAL_GOOGLE_SCRIPT_URL=
```

---

### 3. Run the App

#### Option A: Local Development (Hot Reloading)
From the root directory, run:
```bash
npm run dev
```
This starts both the backend API server and the Vite React frontend concurrently.

#### Option B: Production Build
```bash
# 1. Build the frontend
npm run build

# 2. Start the backend server (which serves the compiled frontend)
npm run backend
```
Open your browser and navigate to `http://localhost:5050`.

---

## 📊 Setting Up Google Sheets Sync

Connecting your Google Sheet takes less than 3 minutes:

1. **Create a Sheet**: Open [Google Sheets](https://sheets.new) and create a new blank spreadsheet.
2. **Open Apps Script**: In the menu bar, go to **Extensions** → **Apps Script**.
3. **Paste the Sync Code**: Delete any placeholder code and paste the following:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Automatically name sheet tab by month (e.g. "2026-11")
    var sheetName = "Expenses";
    if (data.date && data.date.indexOf("-") !== -1) {
      var parts = data.date.split(" ")[0].split("-");
      if (parts.length >= 2) {
        sheetName = parts[0] + "-" + parts[1];
      }
    } else {
      var d = new Date();
      sheetName = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
    
    if (data.action === 'add') {
      // If brand new sheet, initialize headers and summary formulas
      if (sheet.getLastRow() === 0) {
        sheet.getRange("A1:I1").setValues([["Date", "Transaction ID", "User Email", "Item Name", "Cost", "Quantity", "Category", "Group Name", "Total Price"]]);
        sheet.getRange("K1:L1").setValues([["Summary Metrics", "Values"]]).setFontWeight("bold");
        sheet.getRange("K2:K4").setValues([["Total Budget"], ["Total Expenses"], ["Remaining Balance"]]);
        sheet.getRange("L2").setValue(Number(data.budget || 0));
        sheet.getRange("L3").setFormula("=SUM(I2:I)");
        sheet.getRange("L4").setFormula("=L2-L3");
        sheet.getRange("K1:L4").setBorder(true, true, true, true, true, true);
        sheet.getRange("K1:L1").setBackground("#e2e8f0");
        sheet.getRange("K2:K4").setBackground("#f8fafc");
      } else {
        sheet.getRange("L2").setValue(Number(data.budget || 0));
      }
      
      // Find the next available row
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") lastRow = r + 1;
      }
      var nextRow = lastRow + 1;
      
      sheet.getRange(nextRow, 1, 1, 9).setValues([[
        data.date,
        data.id,
        data.userEmail,
        data.name,
        Number(data.cost),
        Number(data.quantity),
        data.category,
        data.groupName || 'Personal',
        Number(data.cost) * Number(data.quantity)
      ]]);
      
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row added' }))
        .setMimeType(ContentService.MimeType.JSON);
    } 
    else if (data.action === 'delete') {
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") lastRow = r + 1;
      }
      
      if (lastRow > 1) {
        var ids = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (ids[i][0] === data.id) {
            sheet.getRange(i + 2, 1, 1, 9).deleteCells(SpreadsheetApp.Dimension.ROWS);
            return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Row deleted' }))
              .setMimeType(ContentService.MimeType.JSON);
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'ID not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. **Deploy as Web App**:
   * Click **Deploy** (top right) → **New deployment**.
   * Select type: **Web app**.
   * Description: `Hisab Khata Sync`.
   * **Execute as**: `Me (your-email@gmail.com)`.
   * **Who has access**: `Anyone` *(necessary so the server can send updates)*.
   * Click **Deploy** and grant permissions.
   * Copy the **Web App URL**.
5. **Connect in App**:
   * Open Hisab Khata → Go to **Settings** (gear icon).
   * Paste the URL into **Apps Script Web App URL** and save.
   * Done! Your expenses will now sync live into Google Sheets.

---

## 🤖 Setting Up the Telegram Bot

1. Open Telegram, search for `@BotFather`, and send `/newbot`.
2. Follow the prompt to pick a bot name and username. Copy the given **API Token**.
3. Add the token to `backend/.env` under `TELEGRAM_BOT_TOKEN=...` and restart your backend.
4. **Link Your Account**:
   * Open Hisab Khata on your phone/browser and go to **Settings** → **Account Profile**.
   * Click **Link Account via Bot** (or copy your Telegram Chat ID and save it in Settings).
5. Start sending expenses like:
   * `Apples 120 Food`
   * `#flat Electricity 1500 Bills`
   * `/report` (to download your PDF statement)

---

## 🛠️ Tech Stack

* **Frontend**: React (Vite), Lucide Icons, Vanilla CSS with custom design tokens, PWA Service Worker + IndexedDB
* **Backend**: Node.js, Express.js, MongoDB (Mongoose ODM)
* **Auth**: JSON Web Tokens (JWT) & bcrypt encryption
* **Integrations**: Google Sheets (Google Apps Script REST), Telegram Bot API, jsPDF

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
Feel free to customize, host your own instance, or contribute!
