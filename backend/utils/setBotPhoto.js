const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const axios = require('axios');
const FormData = require('form-data');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not defined in backend/.env');
  process.exit(1);
}

// Determine which photo to use (defaults to favicon.png, can pass '3d' as argument)
const mode = process.argv[2] === '3d' ? '3d' : 'flat';
const filename = mode === '3d' ? 'logo_3d.jpg' : 'favicon.jpg';
const photoPath = path.join(__dirname, '..', filename);

if (!fs.existsSync(photoPath)) {
  console.error(`❌ Error: Photo file not found at ${photoPath}`);
  process.exit(1);
}

async function setBotProfilePhoto() {
  console.log(`🤖 Setting Telegram Bot profile photo using: ${filename} (${mode} mode)`);
  
  try {
    const formData = new FormData();
    
    // The photo parameter is a JSON-serialized InputProfilePhoto object
    formData.append('photo', JSON.stringify({
      type: 'static',
      photo: 'attach://avatar_file'
    }));
    
    // Attach the actual JPEG file referencing the name used in the photo parameter
    formData.append('avatar_file', fs.createReadStream(photoPath), {
      filename: filename,
      contentType: 'image/jpeg'
    });

    const url = `https://api.telegram.org/bot${token}/setMyProfilePhoto`;
    console.log(`📡 Sending request to Telegram Bot API...`);

    const response = await axios.post(url, formData, {
      headers: formData.getHeaders()
    });

    if (response.data && response.data.ok) {
      console.log('✅ Success! Telegram bot profile photo updated successfully.');
    } else {
      console.error('❌ Failed to update bot photo:', response.data);
    }
  } catch (error) {
    console.error('❌ Error updating bot photo:', error.response?.data || error.message);
  }
}

setBotProfilePhoto();
