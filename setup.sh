#!/bin/bash

# Exit on error for critical commands, but handle prompts and checks gracefully
set -e

# Color variables for pretty console outputs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}      Hisab Khata - Automated Setup Script         ${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "This script will check your prerequisites, install dependencies,"
echo -e "configure environment parameters, compile client assets, and optionally"
echo -e "daemonize the application using systemd."

# ----------------------------------------------------
# 1. PREREQUISITES CHECKS
# ----------------------------------------------------
echo -e "\n${YELLOW}[1/5] Checking system prerequisites...${NC}"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v)
    echo -e "✅ Node.js: Installed (${GREEN}${NODE_VER}${NC})"
else
    echo -e "❌ Node.js: ${RED}Not found${NC}."
    echo -e "Please install Node.js (v18+) before running this setup."
    exit 1
fi

# Check NPM
if command -v npm >/dev/null 2>&1; then
    NPM_VER=$(npm -v)
    echo -e "✅ NPM: Installed (${GREEN}${NPM_VER}${NC})"
else
    echo -e "❌ NPM: ${RED}Not found${NC}."
    echo -e "Please install NPM before running this setup."
    exit 1
fi

# Check MongoDB Status (informational)
if command -v mongod >/dev/null 2>&1 || command -v mongosh >/dev/null 2>&1; then
    echo -e "✅ MongoDB CLI: Installed"
else
    echo -e "⚠️ MongoDB Command line tools not found in PATH."
    echo -e "Ensure MongoDB is running locally on port 27017 or you have a remote Atlas URI ready."
fi

# ----------------------------------------------------
# 2. INSTALL DEPENDENCIES
# ----------------------------------------------------
echo -e "\n${YELLOW}[2/5] Installing project dependencies (backend & frontend)...${NC}"
npm run install-all
echo -e "✅ Dependencies installed successfully."

# ----------------------------------------------------
# 3. ENVIRONMENT CONFIGURATION (.env)
# ----------------------------------------------------
echo -e "\n${YELLOW}[3/5] Configuring environment variables (.env)...${NC}"

ENV_FILE="backend/.env"
ENV_EXAMPLE="backend/.env.example"

# Generate a default secure JWT secret in case the user doesn't provide one
DEFAULT_JWT_SECRET=$(openssl rand -hex 24 2>/dev/null || echo "hk_jwt_secret_$(date +%s)_$(random 2>/dev/null || echo 'default_secret')")

# Check if .env already exists
CON_SETUP=true
if [ -f "$ENV_FILE" ]; then
    echo -e "⚠️  An existing '.env' configuration was found in the backend."
    read -p "Would you like to overwrite it and reconfigure? (y/N): " OVERWRITE_ENV
    if [[ ! "$OVERWRITE_ENV" =~ ^[Yy]$ ]]; then
        echo -e "ℹ️  Keeping current '.env' settings."
        CON_SETUP=false
    fi
fi

if [ "$CON_SETUP" = true ]; then
    if [ ! -f "$ENV_EXAMPLE" ]; then
        echo -e "❌ Error: backend/.env.example is missing. Creating fallback example."
        cat <<EOF > "$ENV_EXAMPLE"
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/hisab_khata
JWT_SECRET=your_jwt_secret_token_here_change_me
GLOBAL_GOOGLE_SCRIPT_URL=
TELEGRAM_BOT_TOKEN=
EOF
    fi

    # Read inputs from the user
    echo -e "\nSetup will prompt for parameters (Press ${CYAN}Enter${NC} to keep default values):\n"

    read -p "Enter server port [default: 5050]: " PORT_VAL
    PORT_VAL=${PORT_VAL:-5050}

    read -p "Enter MongoDB connection URI [default: mongodb://127.0.0.1:27017/hisab_khata]: " DB_VAL
    DB_VAL=${DB_VAL:-mongodb://127.0.0.1:27017/hisab_khata}

    read -p "Enter JWT Secret key [default: (automatically generate)]: " JWT_VAL
    JWT_VAL=${JWT_VAL:-$DEFAULT_JWT_SECRET}

    read -p "Enter Global Google Apps Script Web App URL (optional) [default: None]: " GG_VAL
    GG_VAL=${GG_VAL:-""}

    read -p "Enter Telegram Bot Token (optional) [default: None]: " TG_VAL
    TG_VAL=${TG_VAL:-""}

    # Write parameters to backend/.env
    cat <<EOF > "$ENV_FILE"
PORT=$PORT_VAL
MONGODB_URI=$DB_VAL
JWT_SECRET=$JWT_VAL
GLOBAL_GOOGLE_SCRIPT_URL=$GG_VAL
TELEGRAM_BOT_TOKEN=$TG_VAL
EOF
    echo -e "✅ Environment variables written to ${GREEN}backend/.env${NC}"
fi

# ----------------------------------------------------
# 4. FRONTEND PRODUCTION BUILD
# ----------------------------------------------------
echo -e "\n${YELLOW}[4/5] Building frontend static assets...${NC}"
npm run build
echo -e "✅ Frontend assets successfully built to ${GREEN}frontend/dist/${NC}"

# ----------------------------------------------------
# 5. OPTIONAL SYSTEMD SERVICE SETUP
# ----------------------------------------------------
echo -e "\n${YELLOW}[5/5] Optional: Run Hisab Khata as a background service daemon (systemd)...${NC}"

read -p "Would you like to register Hisab Khata as a systemd service? (y/N): " SETUP_DAEMON
if [[ "$SETUP_DAEMON" =~ ^[Yy]$ ]]; then
    CURR_USER=$(whoami)
    CURR_DIR=$(pwd)
    NODE_EXEC=$(which node || echo "/usr/bin/node")

    echo -e "\nDetecting configuration values:"
    echo -e "  - Running User: ${CYAN}${CURR_USER}${NC}"
    echo -e "  - Working Directory: ${CYAN}${CURR_DIR}/backend${NC}"
    echo -e "  - Node Executor: ${CYAN}${NODE_EXEC}${NC}"

    read -p "Are these parameters correct? (Y/n): " CONFIRM_VARS
    if [[ "$CONFIRM_VARS" =~ ^[Nn]$ ]]; then
        read -p "Enter target system user: " CURR_USER
        read -p "Enter absolute path to 'hisab_khata' root folder: " ROOT_DIR
        CURR_DIR=$ROOT_DIR
        read -p "Enter absolute path to node binary [default: /usr/bin/node]: " NODE_EXEC
        NODE_EXEC=${NODE_EXEC:-/usr/bin/node}
    fi

    # Create service file in tmp directory
    SERVICE_TMP="/tmp/hisab-khata.service"
    cat <<EOF > "$SERVICE_TMP"
[Unit]
Description=Hisab Khata - MERN Budget Tracker
After=network.target

[Service]
Type=simple
User=$CURR_USER
WorkingDirectory=$CURR_DIR/backend
ExecStart=$NODE_EXEC server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    echo -e "\nInstalling service file to systemd (requires sudo permissions)..."
    sudo cp "$SERVICE_TMP" /etc/systemd/system/hisab-khata.service
    rm -f "$SERVICE_TMP"

    echo -e "Reloading systemd daemon..."
    sudo systemctl daemon-reload

    echo -e "Enabling and starting hisab-khata service..."
    sudo systemctl enable hisab-khata.service
    sudo systemctl start hisab-khata.service

    echo -e "✅ systemd service configured and started."
    sudo systemctl status hisab-khata --no-pager || true
else
    echo -e "ℹ️ Skipping systemd configuration."
fi

# ----------------------------------------------------
# WRAP UP
# ----------------------------------------------------
echo -e "\n${BLUE}===================================================${NC}"
echo -e "${GREEN}             Setup Completed Successfully!          ${NC}"
echo -e "${BLUE}===================================================${NC}"

# Read PORT configured
ACTUAL_PORT=$(grep -E "^PORT=" "$ENV_FILE" | cut -d'=' -f2 || echo "5050")

echo -e "\n🎉 Hisab Khata is ready to run!"
if [[ "$SETUP_DAEMON" =~ ^[Yy]$ ]]; then
    echo -e "The application is currently running in the background as a systemd daemon."
    echo -e "You can manage the service using:"
    echo -e "  - Status:   ${CYAN}sudo systemctl status hisab-khata${NC}"
    echo -e "  - Restart:  ${CYAN}sudo systemctl restart hisab-khata${NC}"
    echo -e "  - Logs:     ${CYAN}journalctl -u hisab-khata -f${NC}"
else
    echo -e "To start the application manually, run:"
    echo -e "  ${CYAN}npm run backend${NC}  (or ${CYAN}node backend/server.js${NC})"
fi

echo -e "\nAdmin Notice: ${YELLOW}The first user registered on the login page becomes Root/Admin.${NC}"
echo -e "Open the app in your browser: ${GREEN}http://localhost:${ACTUAL_PORT}${NC}\n"
