import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const OUT = '/opt/cursor/artifacts/screenshots';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900']
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
page.on('console', msg => {
  if (msg.type() === 'error') logs.push('CONSOLE ' + msg.text());
});

await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8787/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.getElementById('conn-badge')?.textContent.includes('連線') || document.getElementById('conn-badge')?.textContent.includes('離線'));
const connText = await page.$eval('#conn-badge', el => el.textContent);
await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: true });

// open student login
await page.evaluate(() => document.getElementById('student-login-panel').classList.remove('hidden'));
await page.type('#student-class', '4A');
await page.type('#student-no', '12');
await page.click('button[onclick="App.enterStudent()"]');
await page.waitForSelector('[data-view="student"]:not(.hidden)');
await page.waitForSelector('#suggest-list .suggest-item');
await page.screenshot({ path: `${OUT}/02-student-suggestions.png`, fullPage: true });

const badge = await page.$eval('#student-badge', el => el.textContent);
const suggestCount = await page.$$eval('#suggest-list .suggest-item', els => els.length);

await page.click('#suggest-list .suggest-item button');
await page.waitForSelector('[data-view="practice"]:not(.hidden)');
await page.waitForSelector('#practice-prompt');
await page.screenshot({ path: `${OUT}/03-practice-question.png`, fullPage: true });

// answer first question via choices or input
const hasChoices = await page.$eval('#practice-choices', el => !el.classList.contains('hidden'));
if (hasChoices) {
  await page.click('#practice-choices .choice-btn');
} else {
  await page.type('#practice-input', '1');
  await page.click('#practice-input-wrap button');
}
await new Promise(r => setTimeout(r, 900));
await page.screenshot({ path: `${OUT}/04-practice-answered.png`, fullPage: true });

await page.click('#btn-back-student');
await page.waitForSelector('[data-view="student"]:not(.hidden)');
await page.click('button[onclick="App.logoutStudent()"]');
await page.waitForSelector('[data-view="home"]:not(.hidden)');

// teacher schedule
await page.evaluate(() => App.openTeacher());
await page.waitForSelector('[data-view="teacher"]:not(.hidden)');
await page.evaluate(() => switchTeacherTab('tab-schedule'));
await page.$eval('#schedule-paste', el => {
  el.value = 'week,topic,goal,startDate,endDate\n1,如何比較分數,比較分數與基準值（例如 1/2 或 1）,2026-09-01,2026-12-31';
});
await page.click('button[onclick="App.uploadSchedule()"]');
await page.waitForFunction(() => document.getElementById('schedule-result').innerText.includes('已匯入'));
await page.screenshot({ path: `${OUT}/05-schedule-import.png`, fullPage: true });

// invalid schedule
await page.$eval('#schedule-paste', el => { el.value = 'week,topic\n1,假課題XYZ'; });
await page.click('button[onclick="App.uploadSchedule()"]');
await new Promise(r => setTimeout(r, 400));
const invalidText = await page.$eval('#schedule-result', el => el.innerText);

await page.evaluate(() => switchTeacherTab('tab-practice'));
const uniqueTitle = `UI練習-${Date.now()}`;
await page.$eval('#prac-title', el => { el.value = ''; });
await page.$eval('#prac-hint', el => { el.value = ''; });
await page.type('#prac-title', uniqueTitle);
await page.type('#prac-hint', '大於二分之一');
await page.click('#tab-practice button[type="submit"]');
await new Promise(r => setTimeout(r, 700));
const bankCount1 = await page.$$eval('#teacher-bank-list li', els => els.length);
await page.$eval('#prac-title', el => { el.value = ''; });
await page.$eval('#prac-hint', el => { el.value = ''; });
await page.type('#prac-title', uniqueTitle);
await page.type('#prac-hint', '大於二分之一');
await page.click('#tab-practice button[type="submit"]');
await new Promise(r => setTimeout(r, 700));
const bankCount2 = await page.$$eval('#teacher-bank-list li', els => els.length);
await page.screenshot({ path: `${OUT}/06-practice-bank.png`, fullPage: true });

await page.evaluate(() => switchTeacherTab('tab-generator'));
await page.waitForSelector('#prompt-output');
const prompt = await page.$eval('#prompt-output', el => el.value);
await page.screenshot({ path: `${OUT}/07-prompt-generator.png`, fullPage: true });

const promptOk = prompt.includes('接球') && prompt.includes('如何比較分數');
const invalidRejected = /找不到|失敗|略過|假課題/.test(invalidText);
const cloudConnected = /已連線/.test(connText);
const result = { connText, cloudConnected, badge, suggestCount, invalidRejected, bankCount1, bankCount2, promptOk, logs };
console.log(JSON.stringify(result, null, 2));

await browser.close();

if (!cloudConnected || !badge.includes('4A') || suggestCount < 1 || bankCount1 < 1 || bankCount2 !== bankCount1 || !promptOk) {
  process.exit(1);
}
