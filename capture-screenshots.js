const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const ARTIFACT_DIR = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\c6898919-e7ea-486c-9882-43581d92d819';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function checkUrl(url) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function capture() {
  console.log('Verifying services are reachable...');
  const backendUp = await checkUrl('http://localhost:5000/health');
  const mobileUp = await checkUrl('http://localhost:5173');
  const dashUp = await checkUrl('http://localhost:5174');

  console.log(`Backend: ${backendUp ? 'UP' : 'DOWN'}, Mobile: ${mobileUp ? 'UP' : 'DOWN'}, Dashboard: ${dashUp ? 'UP' : 'DOWN'}`);

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const mobileScreenPath = path.join(ARTIFACT_DIR, 'mobile_capture_screen.png');
  const dashScreenPath = path.join(ARTIFACT_DIR, 'dashboard_overview_screen.png');

  console.log('Capturing mobile app screenshot...');
  try {
    execSync(`"${CHROME_PATH}" --headless --disable-gpu --screenshot="${mobileScreenPath}" --window-size=430,932 "http://localhost:5173"`, { timeout: 15000 });
    console.log('Mobile screenshot saved to:', mobileScreenPath);
  } catch (e) {
    console.error('Error capturing mobile screenshot:', e.message);
  }

  console.log('Capturing dashboard screenshot...');
  try {
    execSync(`"${CHROME_PATH}" --headless --disable-gpu --screenshot="${dashScreenPath}" --window-size=1440,900 "http://localhost:5174"`, { timeout: 15000 });
    console.log('Dashboard screenshot saved to:', dashScreenPath);
  } catch (e) {
    console.error('Error capturing dashboard screenshot:', e.message);
  }

  console.log('Done capturing screenshots!');
}

capture();
