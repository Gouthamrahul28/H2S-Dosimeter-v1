const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\c6898919-e7ea-486c-9882-43581d92d819';

async function generateScreenshots() {
  console.log('Launching headless Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    // ------------------------------------------------------------
    // 1. MOBILE APP SCREENSHOTS
    // ------------------------------------------------------------
    console.log('Opening mobile page...');
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });
    await mobilePage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));

    // Mobile Screen 1: Worker ID Selection
    const mobile1Path = path.join(ARTIFACT_DIR, 'mobile_1_worker_select.png');
    await mobilePage.screenshot({ path: mobile1Path, fullPage: false });
    console.log('Saved:', mobile1Path);

    // Proceed to Capture Screen
    console.log('Navigating to capture screen in mobile app...');
    const proceedBtn = await mobilePage.$('button.btn-primary');
    if (proceedBtn) {
      await proceedBtn.click();
      await new Promise((r) => setTimeout(r, 1500));
    }

    // Mobile Screen 2: Viewfinder & HUD
    const mobile2Path = path.join(ARTIFACT_DIR, 'mobile_2_viewfinder.png');
    await mobilePage.screenshot({ path: mobile2Path, fullPage: false });
    console.log('Saved:', mobile2Path);

    // Click "🧪 Test Frame" to trigger reading submission & dose calculation
    console.log('Triggering test capture...');
    const testFrameButtons = await mobilePage.$$('button');
    for (const btn of testFrameButtons) {
      const text = await mobilePage.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Test Frame')) {
        await btn.click();
        break;
      }
    }

    // Wait for processing & Result Screen
    await new Promise((r) => setTimeout(r, 3000));
    const mobile3Path = path.join(ARTIFACT_DIR, 'mobile_3_exposure_result.png');
    await mobilePage.screenshot({ path: mobile3Path, fullPage: false });
    console.log('Saved:', mobile3Path);

    await mobilePage.close();

    // ------------------------------------------------------------
    // 2. DASHBOARD SCREENSHOTS
    // ------------------------------------------------------------
    console.log('Opening dashboard page...');
    const dashPage = await browser.newPage();
    await dashPage.setViewport({ width: 1440, height: 900 });
    await dashPage.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1500));

    // Dashboard Screen 1: Overview
    const dash1Path = path.join(ARTIFACT_DIR, 'dash_1_overview.png');
    await dashPage.screenshot({ path: dash1Path, fullPage: false });
    console.log('Saved:', dash1Path);

    // Navigate to Worker History
    console.log('Navigating to Worker History...');
    const navButtons = await dashPage.$$('aside button');
    if (navButtons.length > 1) {
      await navButtons[1].click(); // Second nav item = Worker History
      await new Promise((r) => setTimeout(r, 1500));
    }

    const dash2Path = path.join(ARTIFACT_DIR, 'dash_2_worker_history.png');
    await dashPage.screenshot({ path: dash2Path, fullPage: false });
    console.log('Saved:', dash2Path);

    // Navigate to DGMS / OISD Report
    console.log('Navigating to DGMS Report...');
    if (navButtons.length > 2) {
      await navButtons[2].click(); // Third nav item = DGMS Report
      await new Promise((r) => setTimeout(r, 1500));
    }

    const dash3Path = path.join(ARTIFACT_DIR, 'dash_3_dgms_report.png');
    await dashPage.screenshot({ path: dash3Path, fullPage: false });
    console.log('Saved:', dash3Path);

    await dashPage.close();

    console.log('\nAll 6 high-res screenshots generated successfully!');
  } finally {
    await browser.close();
  }
}

generateScreenshots().catch(console.error);
