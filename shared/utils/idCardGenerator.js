import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve root directory paths
const ROOT_DIR = path.resolve(__dirname, '../../');
const TEMPLATE_PATH = path.join(ROOT_DIR, 'templates/IDCard.html');
const CARD_BG_PATH = path.join(ROOT_DIR, 'assets/card/card_bg.png');
const LOGO_PATH = path.join(ROOT_DIR, 'assets/logo.png');

let cachedTemplate = null;
let cachedBgBase64 = null;
let cachedLogoBase64 = null;

/**
 * Loads and caches base assets as base64 data URIs.
 */
function getCachedAssets() {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  }
  if (!cachedBgBase64) {
    if (fs.existsSync(CARD_BG_PATH)) {
      const bgBuffer = fs.readFileSync(CARD_BG_PATH);
      cachedBgBase64 = `data:image/png;base64,${bgBuffer.toString('base64')}`;
    } else {
      cachedBgBase64 = '';
    }
  }
  if (!cachedLogoBase64) {
    if (fs.existsSync(LOGO_PATH)) {
      const logoBuffer = fs.readFileSync(LOGO_PATH);
      cachedLogoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      cachedLogoBase64 = '';
    }
  }

  return {
    template: cachedTemplate,
    bgImage: cachedBgBase64,
    logoImage: cachedLogoBase64,
  };
}

/**
 * Calculates standard validity string (MM/YY) for ACES memberships.
 * Default cycle ends in August.
 */
export function calculateValidUpto(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  // If registration is in September or later, valid upto August next year
  const validYear = month >= 9 ? year + 1 : year;
  const yy = String(validYear).slice(-2);
  return `08/${yy}`;
}

/**
 * Generates populated HTML string from the IDCard template.
 */
export function generateIdCardHtml({
  fullName = 'MEMBER NAME',
  membershipNo = 'ACES0000',
  validUpto = null,
  bgImage = null,
  logoImage = null,
} = {}) {
  const assets = getCachedAssets();

  const renderedValidUpto = validUpto || calculateValidUpto();
  const renderedBg = bgImage || assets.bgImage;
  const renderedLogo = logoImage || assets.logoImage;

  return assets.template
    .replace(/\{\{MEMBER_NAME\}\}/g, (fullName || 'MEMBER NAME').trim().toUpperCase())
    .replace(/\{\{MEMBERSHIP_NO\}\}/g, (membershipNo || 'ACES0000').trim().toUpperCase())
    .replace(/\{\{VALID_UPTO\}\}/g, renderedValidUpto.trim())
    .replace(/\{\{BG_IMAGE\}\}/g, renderedBg)
    .replace(/\{\{LOGO_IMAGE\}\}/g, renderedLogo);
}

/**
 * Renders the ID Card HTML into a crisp PNG image Buffer using Puppeteer.
 */
export async function generateIdCardPng({
  fullName,
  membershipNo,
  validUpto,
  bgImage,
  logoImage,
} = {}) {
  const html = generateIdCardHtml({
    fullName,
    membershipNo,
    validUpto,
    bgImage,
    logoImage,
  });

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Render with 2x device scale factor for sharp text and graphics
    await page.setViewport({
      width: 600,
      height: 900,
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const cardElement = await page.$('.id-card');
    if (!cardElement) {
      throw new Error('Failed to find .id-card container in rendered HTML.');
    }

    const pngBuffer = await cardElement.screenshot({
      type: 'png',
      omitBackground: true,
    });

    return Buffer.from(pngBuffer);
  } finally {
    await browser.close();
  }
}
