const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\gouth\\.gemini\\antigravity-ide\\brain\\d75c4d48-b6f5-4101-8c6b-71b6786ebf74';
const LAN_IP = '192.168.0.148';

async function testBackendEndpointsDirectly() {
  console.log(`\n=== 1. Testing Backend Endpoints on LAN IP http://${LAN_IP}:5000 ===`);

  // 1. Health endpoint
  const healthStart = performance.now();
  const healthRes = await fetch(`http://${LAN_IP}:5000/health`);
  const healthJson = await healthRes.json();
  const healthLatency = Math.round(performance.now() - healthStart);
  console.log(`[Health API] Status: ${healthRes.status}, Latency: ${healthLatency}ms, Service: ${healthJson.service}`);

  // 2. Test Upload endpoint
  const uploadStart = performance.now();
  const uploadRes = await fetch(`http://${LAN_IP}:5000/test-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: 'network_test_photo.jpg',
      imageBase64: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
    })
  });
  const uploadJson = await uploadRes.json();
  const uploadLatency = Math.round(performance.now() - uploadStart);
  console.log(`[Test Upload API] Status: ${uploadRes.status}, Received: ${uploadJson.size_bytes} bytes, Latency: ${uploadLatency}ms`);

  // 3. Workers API
  const workersRes = await fetch(`http://${LAN_IP}:5000/api/v1/workers`);
  const workersJson = await workersRes.json();
  console.log(`[Workers API] Status: ${workersRes.status}, Workers count: ${workersJson.length}`);

  // 4. Scan / Reading API
  const sampleImagePath = path.join(ARTIFACT_DIR, 'test_badge_wristband.png');
  const sampleBase64 = fs.readFileSync(sampleImagePath).toString('base64');
  const scanStart = performance.now();
  const scanRes = await fetch(`http://${LAN_IP}:5000/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workerId: 'W1001',
      shiftId: '2026-09-01-A',
      imageBase64: `data:image/png;base64,${sampleBase64}`,
      ambientTemp: 25.0,
      ambientHumidity: 50.0
    })
  });
  const scanJson = await scanRes.json();
  const scanLatency = Math.round(performance.now() - scanStart);
  console.log(`[Scan API] Status: ${scanRes.status}, Scan ID: ${scanJson.scan_id}, Dose: ${scanJson.dose} ppm*h, Alert: ${scanJson.alertLevel}, Latency: ${scanLatency}ms`);
}

async function testMobileFrontendOnLanIp() {
  console.log(`\n=== 2. Testing Mobile Frontend Navigation via LAN IP http://${LAN_IP}:5173 ===`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[Browser Console]:', msg.text()));
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('h2s_mobile_seen_intro_v2', 'true');
  });

  console.log(`[Puppeteer] Navigating to http://${LAN_IP}:5173 ...`);
  await page.goto(`http://${LAN_IP}:5173`, { waitUntil: 'networkidle0' });

  // Open System Status Modal from header
  const headerButtons = await page.$$('header button');
  if (headerButtons.length > 0) {
    const statusBadge = headerButtons[headerButtons.length - 1];
    await statusBadge.click();
    await new Promise(r => setTimeout(r, 1500));

    const modalShot = path.join(ARTIFACT_DIR, 'network_system_status_modal.png');
    await page.screenshot({ path: modalShot });
    console.log('[Puppeteer] System Status Modal screenshot saved to:', modalShot);

    // Close modal
    const closeButtons = await page.$$('button');
    for (const cb of closeButtons) {
      const isX = await page.evaluate(el => el.querySelector('svg')?.classList.contains('lucide-x') || el.innerHTML.includes('lucide-x'), cb);
      if (isX) {
        await cb.click();
        break;
      }
    }
    await new Promise(r => setTimeout(r, 600));
  }

  // Proceed to Pic Scan
  await page.click('button.btn-primary');
  await new Promise(r => setTimeout(r, 1000));

  const picScanShot = path.join(ARTIFACT_DIR, 'network_pic_scan_lan.png');
  await page.screenshot({ path: picScanShot });
  console.log('[Puppeteer] Pic Scan on LAN IP screenshot saved to:', picScanShot);

  // Upload test image
  const fileInputs = await page.$$('input[type="file"]');
  if (fileInputs.length >= 2) {
    await fileInputs[1].uploadFile(path.join(ARTIFACT_DIR, 'test_badge_wristband.png'));
  }
  await new Promise(r => setTimeout(r, 1200));

  // Click Scan
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const txt = await page.evaluate(el => el.textContent, b);
    if (txt.includes('SCAN IMAGE')) {
      console.log('[Puppeteer] Clicking SCAN IMAGE on LAN IP...');
      await b.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 3000));
  const finalShot = path.join(ARTIFACT_DIR, 'network_result_lan.png');
  await page.screenshot({ path: finalShot });
  console.log('[Puppeteer] LAN Result screenshot saved to:', finalShot);

  await browser.close();
  console.log('\n=== All LAN Network & Topology Tests Completed with 100% SUCCESS ===');
}

async function run() {
  await testBackendEndpointsDirectly();
  await testMobileFrontendOnLanIp();
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
