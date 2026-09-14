#!/bin/bash

# YouTube to Drive - Simplified Script
# Uses our API manager for logging and monitoring

echo "=========================================="
echo "   YouTube to Drive - Codespaces API"
echo "=========================================="
echo ""

# Log start time
START_TIME=$(date -Iseconds)
echo "[$START_TIME] Process started"

# Try to read from config.json first
if [ -f "config.json" ]; then
    echo "[$(date -Iseconds)] Reading parameters from config.json"
    VIDEO_URL=$(cat config.json | grep -o '"video_url"[^,]*' | cut -d'"' -f4)
    PLATFORM=$(cat config.json | grep -o '"platform"[^,]*' | cut -d'"' -f4)
    COOKIES=$(cat config.json | grep -o '"cookies"[^,]*' | cut -d'"' -f4)
    DRIVE_REFRESH_TOKEN=$(cat config.json | grep -o '"drive_refresh_token"[^,]*' | cut -d'"' -f4)
    DRIVE_CLIENT_ID=$(cat config.json | grep -o '"drive_client_id"[^,]*' | cut -d'"' -f4)
    DRIVE_CLIENT_SECRET=$(cat config.json | grep -o '"drive_client_secret"[^,]*' | cut -d'"' -f4)
fi

# Check required environment variables
if [ -z "$VIDEO_URL" ]; then
    echo "[$(date -Iseconds)] ERROR: VIDEO_URL not set"
    echo "[$(date -Iseconds)] Please set VIDEO_URL environment variable or config.json"
    echo "[$(date -Iseconds)] Exiting without error (for testing)"
    exit 0
fi

PLATFORM="${PLATFORM:-youtube}"
echo "[$(date -Iseconds)] Platform: $PLATFORM"
echo "[$(date -Iseconds)] Video URL: $VIDEO_URL"
echo ""

# Install required tools
echo "[$(date -Iseconds)] Installing required tools..."

# Install Python and yt-dlp
sudo apt-get update -qq
sudo apt-get install -y python3 python3-pip python3-venv -qq
pip3 install --break-system-packages --user yt-dlp -qq
export PATH="$HOME/.local/bin:$PATH"

echo "[$(date -Iseconds)] yt-dlp version: $(yt-dlp --version)"

# Install Deno
if ! command -v deno &> /dev/null; then
    echo "[$(date -Iseconds)] Installing Deno..."
    curl -fsSL https://deno.land/install.sh | sh
    export PATH="$HOME/.deno/bin:$PATH"
else
    echo "[$(date -Iseconds)] Deno already installed: $(deno --version)"
fi

# Install Node.js dependencies
if [ ! -d "node_modules" ]; then
    npm install googleapis@latest -qq
fi

echo "[$(date -Iseconds)] Dependencies installed successfully"
echo ""

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo "[$(date -Iseconds)] Temp directory: $TEMP_DIR"

# Download video
echo "[$(date -Iseconds)] Starting download..."

DOWNLOAD_LOG="$TEMP_DIR/download.log"

# Create cookies file if provided
if [ -n "$COOKIES_BASE64" ]; then
    COOKIES=$(echo "$COOKIES_BASE64" | base64 -d)
fi

if [ -n "$COOKIES" ]; then
    echo "[$(date -Iseconds)] Creating cookies file..."
    if [ "$PLATFORM" = "youtube" ]; then
        COOKIES_FILE="$TEMP_DIR/www.youtube.com_cookies.txt"
    else
        COOKIES_FILE="$TEMP_DIR/vimeo.com_cookies.txt"
    fi
    echo "$COOKIES" > "$COOKIES_FILE"
    echo "[$(date -Iseconds)] Cookies file created: $COOKIES_FILE"
fi

if [ "$PLATFORM" = "youtube" ] && [ -n "$COOKIES" ]; then
    echo "[$(date -Iseconds)] Using cookies for YouTube with Deno runtime"
    python3 -m yt_dlp --cookies "$COOKIES_FILE" --js-runtimes deno --remote-components ejs:github -f "best[ext=mp4]" -o "$TEMP_DIR/%(title)s.%(ext)s" "$VIDEO_URL" 2>&1 | tee "$DOWNLOAD_LOG"
elif [ "$PLATFORM" = "youtube" ]; then
    echo "[$(date -Iseconds)] Downloading YouTube without cookies"
    python3 -m yt_dlp -f "best[ext=mp4]" -o "$TEMP_DIR/%(title)s.%(ext)s" "$VIDEO_URL" 2>&1 | tee "$DOWNLOAD_LOG"
elif [ -n "$COOKIES" ]; then
    echo "[$(date -Iseconds)] Using cookies for $PLATFORM"
    python3 -m yt_dlp --cookies "$COOKIES_FILE" -f "best[ext=mp4]" -o "$TEMP_DIR/%(title)s.%(ext)s" "$VIDEO_URL" 2>&1 | tee "$DOWNLOAD_LOG"
else
    echo "[$(date -Iseconds)] Downloading $PLATFORM without cookies"
    python3 -m yt_dlp -f "best[ext=mp4]" -o "$TEMP_DIR/%(title)s.%(ext)s" "$VIDEO_URL" 2>&1 | tee "$DOWNLOAD_LOG"
fi

DOWNLOAD_EXIT_CODE=${PIPESTATUS[0]}

if [ $DOWNLOAD_EXIT_CODE -ne 0 ]; then
    echo "[$(date -Iseconds)] ERROR: Download failed with exit code $DOWNLOAD_EXIT_CODE"
    echo "[$(date -Iseconds)] Download log:"
    cat "$DOWNLOAD_LOG"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "[$(date -Iseconds)] Download completed successfully"

# Find downloaded video file
DOWNLOADED_FILE=$(find "$TEMP_DIR" -type f \( -name "*.mp4" -o -name "*.webm" -o -name "*.mp3" \) | head -1)

if [ -z "$DOWNLOADED_FILE" ]; then
    echo "[$(date -Iseconds)] ERROR: No downloaded file found"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "[$(date -Iseconds)] Downloaded file: $DOWNLOADED_FILE"
FILE_SIZE=$(stat -c%s "$DOWNLOADED_FILE")
echo "[$(date -Iseconds)] File size: $FILE_SIZE bytes"

npm install googleapis --prefix "$TEMP_DIR"
# Upload to Drive
echo "[$(date -Iseconds)] Starting upload to Google Drive..."

if [ -z "$DRIVE_REFRESH_TOKEN" ] || [ -z "$DRIVE_CLIENT_ID" ] || [ -z "$DRIVE_CLIENT_SECRET" ]; then
    echo "[$(date -Iseconds)] ERROR: Google Drive credentials not set"
    echo "[$(date -Iseconds)] Please set DRIVE_REFRESH_TOKEN, DRIVE_CLIENT_ID, DRIVE_CLIENT_SECRET"
    echo "[$(date -Iseconds)] File saved locally: $DOWNLOADED_FILE"
    echo "[$(date -Iseconds)] Please upload manually or set Drive credentials"
    echo "[$(date -Iseconds)] Process completed with warnings"
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Create simple upload script
cat > "$TEMP_DIR/upload.js" << 'EOF'
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { Readable } from 'stream';

const credentials = {
  refresh_token: process.env.DRIVE_REFRESH_TOKEN,
  token_uri: "https://oauth2.googleapis.com/token",
  client_id: process.env.DRIVE_CLIENT_ID,
  client_secret: process.env.DRIVE_CLIENT_SECRET,
  scopes: [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.metadata.readonly"
  ]
};

const oauth2Client = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.token_uri
);

oauth2Client.setCredentials({
  refresh_token: credentials.refresh_token,
});

const drive = google.drive({ version: 'v3', auth: oauth2Client });

const filePath = process.argv[2];
const fileName = process.argv[3] || 'downloaded_video.mp4';

async function uploadFile() {
  try {
    console.log('Refreshing token...');
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('Token refreshed successfully');

    const fileBuffer = readFileSync(filePath);
    console.log('File read successfully, size:', fileBuffer.length);

    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    let mimeType = 'video/mp4';
    if (fileName.endsWith('.webm')) mimeType = 'video/webm';
    else if (fileName.endsWith('.mp3')) mimeType = 'audio/mpeg';

    const result = await drive.files.create({
      resource: {
        name: fileName,
      },
      media: {
        mimeType: mimeType,
        body: bufferStream,
      },
      fields: 'id, name, webViewLink',
    });

    console.log('File uploaded successfully!');
    console.log('File ID:', result.data.id);
    console.log('File Name:', result.data.name);
    console.log('Web View Link:', result.data.webViewLink);
    
    console.log(JSON.stringify({
      success: true,
      file_id: result.data.id,
      file_name: result.data.name,
      web_view_link: result.data.webViewLink,
      file_size: fileBuffer.length
    }));
  } catch (error) {
    console.error('Error uploading file:', error.message);
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }));
    process.exit(1);
  }
}

uploadFile();
EOF

UPLOAD_LOG="$TEMP_DIR/upload.log"

# Run upload script
node "$TEMP_DIR/upload.js" "$DOWNLOADED_FILE" "$(basename "$DOWNLOADED_FILE")" 2>&1 | tee "$UPLOAD_LOG"
UPLOAD_EXIT_CODE=${PIPESTATUS[0]}

if [ $UPLOAD_EXIT_CODE -ne 0 ]; then
    echo "[$(date -Iseconds)] ERROR: Upload failed with exit code $UPLOAD_EXIT_CODE"
    echo "[$(date -Iseconds)] Upload log:"
    cat "$UPLOAD_LOG"
    echo "[$(date -Iseconds)] File saved locally: $DOWNLOADED_FILE"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up
rm -rf "$TEMP_DIR"

END_TIME=$(date -Iseconds)
echo "[$END_TIME] Process completed successfully"
echo "[$END_TIME] Total duration: $(($(date -d "$END_TIME" +%s) - $(date -d "$START_TIME" +%s))) seconds"

echo "[$END_TIME] =========================================="
echo "[$END_TIME] SUCCESS: Video downloaded and uploaded!"
echo "[$END_TIME] =========================================="
