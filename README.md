# Hisab Khata 📱 - Premium MERN Budget & Expense Tracker

Hisab Khata is a mobile-first, premium-designed budget and expense tracking web application built on the **MERN Stack** (MongoDB, Express, React, Node.js). It supports user sign-up/login, custom category management, shared groups, and real-time syncing to Google Sheets via Google Apps Script. 

Additionally, it integrates a powerful **Telegram Bot Service** that allows users to instantly record expenses, select active logging scopes, and generate PDF reports directly inside Telegram.

---

## ✨ Features & Facilities

*   📱 **Mobile-First Glassmorphic Design**: Sleek dark/light styled layout, glassmorphic card designs, tailored HSL color variables, and native-app feel animations.
*   ⚡ **Insta-Track Form**: The tracking entry form is right on the homepage, allowing you to log expenses in under 5 seconds.
*   🏷️ **Custom Category Creation**: Personalize categories with custom names and color pickers. Default categories (Food, Transport, Bills, etc.) are automatically seeded upon signup.
*   🛡️ **Secure JWT Authentication**: Built-in authorization, encryption using `bcryptjs`, and secure session persistence.
*   👥 **Shared Groups**: Create expense groups, invite members, configure individual budgets, and log shared expenses. Perfect for roommates, flatmates, and family tracking.
*   📊 **Google Sheets Sync**: Real-time synchronization. Adding or deleting transactions instantly appends/removes rows from your designated Google Sheet.
*   🤖 **Telegram Logging Integration**: Send text commands (e.g., `Egg 80 food`) to your own Telegram bot, and it will immediately log the transaction and sync with MongoDB & Google Sheets.
*   📄 **PDF Cost Analysis**: Generate detailed, high-quality PDF reports summarizing expenses by category, user contributions, and budget status, available both in-app and via Telegram.

---

## 📱 Progressive Web App (PWA) Facilities

Hisab Khata is built as a fully-compliant **Progressive Web App (PWA)**, allowing users to install and run the application like a native mobile or desktop app:

*   📱 **Installability**: Installable directly from compatible web browsers (Safari on iOS, Chrome on Android/Desktop) with custom launcher icons and a splash screen.
*   🖥️ **Standalone Experience**: Runs in a standalone window, removing browser URL bars and navigation controls, with lock-portrait orientation configured for a native mobile feel.
*   🔌 **Offline Operation**:
    *   **Core UI Shell Pre-caching**: Core assets (`index.html`, `manifest.json`, icons) are pre-cached locally on the user's device during the first visit.
    *   **Stale-While-Revalidate Caching**: Static assets (scripts, styles, images) are served instantly from the cache while updating in the background, minimizing load times.
    *   **Offline Data Logging**: If a network connection is lost, users can still review transactions and add new entries locally (utilizing local storage/IndexedDB databases), which automatically queue and sync once the connection is restored.
*   🔄 **Automated Hot-Reload Updates**: The browser client listens for update notifications from the active Service Worker. When a new release is built and deployed on the server, the app automatically performs a hot-reload in the background to ensure users are always running the latest version without manual page refreshing.

---

## 🛡️ Dynamic Admin Account

To make hosting simple, Hisab Khata uses a dynamic admin allocation system:
*   **The First Signup Rule**: The very first user account registered on a fresh deployment (when the database user count is `0`) is automatically assigned the **Admin/Root** role.
*   **Admin Facilities**:
    *   Access to the **Admin Control Panel** in Account Settings.
    *   Ability to monitor all registered users (Username, Email, Registration Date).
    *   Ability to **temporarily pause signup** for new users (useful for private hosting).
    *   Ability to permanently delete users and all their associated data (transactions, custom categories, groups, and memberships).
    *   **Root Protection**: Admins cannot delete other admins or themselves.

---

## 🚀 Server Installation Guide

Follow these steps to host your own instance of Hisab Khata on a Linux server (e.g., Ubuntu).

### Prerequisites
Make sure your server has the following installed:
1.  **Node.js (v18+)**
2.  **MongoDB** (running locally or configured via MongoDB Atlas)
3.  **Git**

---

### Method A: Automated Quick Setup (Not Tested Yet!)

To run the interactive automated setup script which handles dependency checking, package installation, environment variable creation, client compilation, and optional systemd background service registration:

```bash
chmod +x setup.sh
./setup.sh
```

---

### Method B: Manual Step-by-Step Installation

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/your-username/hisab-khata.git
cd hisab-khata

# Install all packages (root, backend, and frontend) in one command
npm run install-all
```

---

### Step 2: Environment Configuration

Navigate to the `backend/` directory and configure the environment variables:

```bash
cd backend
cp .env.example .env
nano .env
```

Fill in the variables in `.env`:
*   `PORT`: Port for the backend API server (default is `5050`).
*   `MONGODB_URI`: Your MongoDB connection string (e.g., `mongodb://127.0.0.1:27017/hisab_khata`).
*   `JWT_SECRET`: A secure random string for JWT token generation.
*   `GLOBAL_GOOGLE_SCRIPT_URL`: *(Optional)* Default Apps Script Web App URL for fallback.
*   `TELEGRAM_BOT_TOKEN`: The API token for your Telegram Bot (see Telegram Setup below).

---

### Step 3: Production Build

Since the Express backend is configured to serve the compiled frontend React app, you must build the client assets:

```bash
# From the project root directory
npm run build
```

This compiles the React application into `/frontend/dist/`, which is automatically served by the Express server on root (`/`).

---

### Step 4: Daemonize with systemd (Run in Background)

To ensure the server starts automatically and restarts on failure, configure it as a systemd service using the provided template:

1.  Copy the service file to your systemd services directory:
    ```bash
    sudo cp hisab-khata.service /etc/systemd/system/hisab-khata.service
    ```
2.  Edit the file to match your server paths and user:
    ```bash
    sudo nano /etc/systemd/system/hisab-khata.service
    ```
    Ensure the paths align with your setup:
    ```ini
    [Service]
    User=your-server-username
    WorkingDirectory=/home/your-server-username/hisab_khata/backend
    ExecStart=/usr/bin/node server.js
    ```
3.  Enable and start the service:
    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable hisab-khata
    sudo systemctl start hisab-khata
    ```
4.  Check the status:
    ```bash
    sudo systemctl status hisab-khata
    ```

---

## 🤖 Telegram Bot Configuration & Commands

### 1. Create a Bot
1.  Open Telegram and search for `@BotFather`.
2.  Send `/newbot` and follow the instructions to name your bot and choose a username.
3.  Copy the generated **API Token** and add it to your `backend/.env` file under `TELEGRAM_BOT_TOKEN`.
4.  Restart your server. The bot will automatically start polling for updates!

---

### 2. Linking Your Account
To prevent random users from logging expenses to your account, your Telegram account must be linked:
1.  Open the web app, log in, and go to **Settings** -> **Account Profile**.
2.  Find the **Link Telegram** section.
3.  Either click the **Link Account via Bot** button (which opens Telegram with a unique token) OR copy your **Chat ID** (the bot will display it if you type `/start` in the chat) and paste it into the Telegram Chat ID input in Settings, then click **Save Profile**.

---

### 3. Usage & Commands
Once linked, you can log expenses and generate reports directly from the Telegram chat.

| Command | Description |
| :--- | :--- |
| `/start` | Initial greeting, provides Chat ID or processes secure link token. |
| `/link` | Shows manual linking instructions. |
| `/status` / `/active` | Shows bot online status, active user, and active logging scope. |
| `/me` | Shows linked account profile details. |
| `/setgroup` | Displays buttons/hashtags to select default group for expense logging. |
| `/report` / `/download` | Displays buttons to download PDF Cost Analysis (Personal or Group). |

#### 💸 Logging an Expense (Personal)
To log an expense, send a message in the format:
`[Item Name] [Cost] [Category]`

> **Example**: `Egg 80 food`
> *   Item Name: `Egg`
> *   Cost: `80`
> *   Category: `food` (the bot matches the input "food" with your existing categories, falling back to "Others" if not matched)

#### 👥 Logging to a Group
You can specify a group target in two ways:
1.  **Direct Hashtag Prefix**: Prefix your message with `#groupname`.
    > **Example**: `#flat Potato 50 Food` (logs "Potato" to group "Flat")
    > *Use `#personal` or `#self` to explicitly log to personal account.*
2.  **Default Active Group**: Run `/setgroup` and select a group. All subsequent messages without hashtags will default to this group.

---

## 📊 Google Sheets Sync Setup

Follow these steps to connect your expense logs with a Google Sheet:

### 1. Create a Google Sheet
Create a new, blank sheet in Google Sheets. You can name it whatever you like (e.g., "Hisab Khata Records").

### 2. Add Apps Script Code
1.  In Google Sheets, click on **Extensions** > **Apps Script**.
2.  Erase any placeholder code and paste the script below:

```javascript
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Determine sheet name (tab name) from transaction date in format YYYY-MM
    var sheetName = "Expenses";
    if (data.date && data.date.indexOf("-") !== -1) {
      var parts = data.date.split(" ")[0].split("-");
      if (parts.length >= 2) {
        sheetName = parts[0] + "-" + parts[1]; // e.g. "2026-07"
      }
    } else {
      var d = new Date();
      var y = d.getFullYear();
      var m = ("0" + (d.getMonth() + 1)).slice(-2);
      sheetName = y + "-" + m;
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (data.action === 'add') {
      // Check if new sheet, initialize headers & summary table
      if (sheet.getLastRow() === 0) {
        // Headers start from row 1
        sheet.getRange("A1:I1").setValues([["Date", "Transaction ID", "User Email", "Item Name", "Cost", "Quantity", "Category", "Group Name", "Total Price"]]);
        
        // Summary Table in Columns K and L
        sheet.getRange("K1:L1").setValues([["Summary Metrics", "Values"]]).setFontWeight("bold");
        sheet.getRange("K2:K4").setValues([["Total Budget"], ["Total Expenses"], ["Remaining Balance"]]);
        sheet.getRange("L2").setValue(Number(data.budget || 0));
        sheet.getRange("L3").setFormula("=SUM(I2:I)");
        sheet.getRange("L4").setFormula("=L2-L3");
        
        sheet.getRange("K1:L4").setBorder(true, true, true, true, true, true);
        sheet.getRange("K1:L1").setBackground("#e2e8f0");
        sheet.getRange("K2:K4").setBackground("#f8fafc");
      } else {
        // Update budget with latest value
        sheet.getRange("L2").setValue(Number(data.budget || 0));
      }
      
      // Find the last row in Column A to place the next transaction row
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
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
      // Find transaction ID in Column B
      var lastRow = 1;
      var values = sheet.getRange("A1:A").getValues();
      for (var r = 0; r < values.length; r++) {
        if (values[r][0] !== "") {
          lastRow = r + 1;
        }
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

### 3. Deploy the Apps Script as a Web App
1.  Click the blue **Deploy** button at the top right and select **New deployment**.
2.  Under the gear icon, choose **Web app**.
3.  Fill out the configuration:
    *   **Description**: `Hisab Khata API Sync`
    *   **Execute as**: `Me (your-email@gmail.com)`
    *   **Who has access**: `Anyone` *(Crucial so that the backend server can make POST requests to it)*
4.  Click **Deploy**.
5.  Authorize access by clicking **Authorize access**, choose your Google account, click **Advanced**, click **Go to Untitled project (unsafe)**, and choose **Allow**.
6.  Copy the **Web App URL** generated under the deployment details.

### 4. Hook up to the App
1.  Open the Hisab Khata App in your browser.
2.  Register and log in.
3.  Click the **Settings** (gear icon) on the bottom navigation bar.
4.  Paste the copied URL into the **Apps Script Web App URL** input field.
5.  Click **Save URL Config**.
6.  Switch back to the **Track** tab and add an expense. It will save locally to MongoDB and instantly append as a row in your Google Sheet!
