const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const dir = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\9aa506af-7561-42b7-8dae-500d78425da8';

async function captureResultScreen() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('h2s_mobile_seen_intro_v2', 'true');
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 600));

  // 1. Select W1026
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('W1026')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 600));

  // 2. Click "START PIC SCAN"
  const startBtn = await page.$('button.btn-primary');
  if (startBtn) {
    await startBtn.click();
  }
  await new Promise(r => setTimeout(r, 800));

  // 3. Upload photo
  const testImgPath = path.join(__dirname, '../backend/uploads/sample-w1024-shift1.jpg');
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length > 0) {
    await fileInputs[fileInputs.length - 1].uploadFile(testImgPath);
  }
  await new Promise(r => setTimeout(r, 1200));

  // 4. Click "SCAN IMAGE"
  const scanButtons = await page.$$('button');
  for (const b of scanButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('SCAN IMAGE')) {
      await b.click();
      break;
    }
  }

  // Wait for scan analysis and transition to ResultScreen
  await new Promise(r => setTimeout(r, 3500));

  await page.screenshot({ path: path.join(dir, 'mobile_result_lead_acetate.png') });
  console.log('Saved mobile_result_lead_acetate.png');

  await browser.close();
}

captureResultScreen().catch(console.error);
