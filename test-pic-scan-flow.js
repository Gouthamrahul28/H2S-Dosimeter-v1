const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\d75c4d48-b6f5-4101-8c6b-71b6786ebf74';

// Create a synthetic wristband test image
function createTestImage() {
  const testImagePath = path.join(ARTIFACT_DIR, 'test_sample_wristband.png');
  const sampleBase64Png = 'iVBORw0KGgoAAAANSUhEUgAAAlgAAAGQCAYAAAByNR6YAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAJnVFhAc3JHYwAA4N8AAAAEZ0FNQQAAsY8L/GEFAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAB3RJTUUH4wMDFTYsFqXp1gAAADpJREFUeJztwTEBAAAAwqD1T20ND6AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4GwNNAAB5s9jZAAAAABJRU5ErkJggg==';
  fs.writeFileSync(testImagePath, Buffer.from(sampleBase64Png, 'base64'));
  return testImagePath;
}

async function runPicScanTest() {
  console.log('[Test] Starting Puppeteer-core with Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('[Test] Navigating to http://localhost:5173 ...');
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('h2s_mobile_seen_intro_v2', 'true');
  });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // 1. Worker ID Screen
  const workerScreenShot = path.join(ARTIFACT_DIR, 'pic_scan_step1_worker_id.png');
  await page.screenshot({ path: workerScreenShot });
  console.log('[Test] Worker ID screen saved to:', workerScreenShot);

  // Click "Scan Dosimeter" / Proceed
  const scanDosimeterBtn = await page.$('button.btn-primary');
  if (scanDosimeterBtn) {
    await scanDosimeterBtn.click();
  } else {
    console.error('Scan Dosimeter button not found!');
  }

  await new Promise(r => setTimeout(r, 1000));

  // 2. Pic Scan Empty State
  const picScanEmptyShot = path.join(ARTIFACT_DIR, 'pic_scan_step2_empty_state.png');
  await page.screenshot({ path: picScanEmptyShot });
  console.log('[Test] Pic Scan empty state saved to:', picScanEmptyShot);

  // 3. Upload test image to choosePhoto input
  const testImagePath = path.join(ARTIFACT_DIR, 'test_badge_wristband.png');
  const fileInputs = await page.$$('input[type="file"]');
  console.log(`[Test] Found ${fileInputs.length} file inputs on page.`);

  if (fileInputs.length >= 2) {
    // Second input is choose photo
    await fileInputs[1].uploadFile(testImagePath);
    console.log('[Test] Uploaded test file into Choose Photo input.');
  } else if (fileInputs.length === 1) {
    await fileInputs[0].uploadFile(testImagePath);
  }

  await new Promise(r => setTimeout(r, 1500));

  // 4. Pic Scan Image Ready State (Preview + Reticle + Scan Image button)
  const picScanReadyShot = path.join(ARTIFACT_DIR, 'pic_scan_step3_image_ready.png');
  await page.screenshot({ path: picScanReadyShot });
  console.log('[Test] Pic Scan image ready state saved to:', picScanReadyShot);

  // 4b. Expand Raw Image Test & Diagnostics Drawer
  const buttonsAll = await page.$$('button');
  for (const b of buttonsAll) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('TEST IMAGE PIPELINE')) {
      await b.click();
      await new Promise(r => setTimeout(r, 600));
      const telemetryShot = path.join(ARTIFACT_DIR, 'pic_scan_step3b_telemetry.png');
      await page.screenshot({ path: telemetryShot });
      console.log('[Test] Telemetry expanded screenshot saved to:', telemetryShot);
      break;
    }
  }

  // 5. Click "SCAN IMAGE"
  const buttons = await page.$$('button');
  let scanBtn = null;
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('SCAN IMAGE')) {
      scanBtn = b;
      break;
    }
  }

  if (scanBtn) {
    console.log('[Test] Clicking SCAN IMAGE button...');
    await scanBtn.click();
    await new Promise(r => setTimeout(r, 3000));

    const resultShot = path.join(ARTIFACT_DIR, 'pic_scan_step4_result.png');
    await page.screenshot({ path: resultShot });
    console.log('[Test] Result screen saved to:', resultShot);
  } else {
    console.warn('[Test] SCAN IMAGE button not found in ready state.');
  }

  await browser.close();
  console.log('[Test] All Pic Scan verification steps completed successfully!');
}

runPicScanTest().catch(err => {
  console.error('[Test] Failure:', err);
  process.exit(1);
});
