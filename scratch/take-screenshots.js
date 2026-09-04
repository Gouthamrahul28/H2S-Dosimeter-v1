const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const dir = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\9aa506af-7561-42b7-8dae-500d78425da8';

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const mobilePath = path.join(dir, 'mobile_live.png');
const dashPath = path.join(dir, 'dashboard_live.png');

console.log('Capturing mobile screenshot...');
execSync(`"${CHROME}" --headless --disable-gpu --screenshot="${mobilePath}" --window-size=430,932 http://localhost:5173`, { timeout: 20000 });
console.log('Mobile screenshot saved to:', mobilePath);

console.log('Capturing dashboard screenshot...');
execSync(`"${CHROME}" --headless --disable-gpu --screenshot="${dashPath}" --window-size=1440,900 http://localhost:5174`, { timeout: 20000 });
console.log('Dashboard screenshot saved to:', dashPath);

console.log('Done!');
