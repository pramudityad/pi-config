import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({
  browserURL: 'http://127.0.0.1:9222',
});

const pages = await browser.pages();
const page = pages[pages.length - 1]; // last opened tab

const filePath = '/Users/FLP9damarpramuditya/Project/career-ops/output/027-wrs-health-cv.pdf';

// Upload file to file input
const input = await page.$('#resumator-resume-value');
if (!input) {
  console.log('File input not found');
  await browser.disconnect();
  process.exit(1);
}

await input.uploadFile(filePath);
console.log('File uploaded successfully');
console.log('Form is ready for review. There is a reCAPTCHA - submission needs manual handling.');

await browser.disconnect();
