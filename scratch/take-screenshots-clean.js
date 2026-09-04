const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const dir = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\9aa506af-7561-42b7-8dae-500d78425da8';

async function captureClean() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu']
  });

  // Mobile App
  const pageMobile = await browser.newPage();
  await pageMobile.setViewport({ width: 390, height: 844, isMobile: true });
  await pageMobile.evaluateOnNewDocument(() => {
    localStorage.setItem('h2s_mobile_seen_intro_v2', 'true');
    localStorage.setItem('h2s_mobile_active_worker', 'W1026');
  });
  await pageMobile.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await pageMobile.screenshot({ path: path.join(dir, 'mobile_clean.png') });
  console.log('Mobile clean screenshot saved');

  // Dashboard
  const pageDash = await browser.newPage();
  await pageDash.setViewport({ width: 1440, height: 900 });
  await pageDash.evaluateOnNewDocument(() => {
    localStorage.setItem('h2s_seen_orientation_guide_v1', 'true');
    localStorage.setItem('h2s_onboarding_completed', 'true');
  });
  await pageDash.goto('http://localhost:5174', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));
  await pageDash.screenshot({ path: path.join(dir, 'dashboard_clean.png') });
  console.log('Dashboard clean screenshot saved');

  await browser.close();
}

captureClean().catch(console.error);
