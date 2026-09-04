const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const dir = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\9aa506af-7561-42b7-8dae-500d78425da8';

async function captureLeadAcetateFlow() {
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
  await new Promise(r => setTimeout(r, 800));

  // Click on W1026 (Vikram) button
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('W1026')) {
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: path.join(dir, 'mobile_w1026_lead_acetate.png') });
  console.log('Saved mobile_w1026_lead_acetate.png');

  await browser.close();
}

captureLeadAcetateFlow().catch(console.error);
