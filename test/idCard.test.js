import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIdCardHtml,
  generateIdCardPng,
  calculateValidUpto,
} from '../shared/utils/idCardGenerator.js';

describe('Digital ID Card Generator Unit Tests', () => {
  it('should calculate valid upto date properly', () => {
    const testDate = new Date('2026-03-15');
    const validStr = calculateValidUpto(testDate);
    assert.equal(validStr, '08/26');

    const lateYearDate = new Date('2026-10-01');
    const lateValidStr = calculateValidUpto(lateYearDate);
    assert.equal(lateValidStr, '08/27');
  });

  it('should generate populated HTML with member details', () => {
    const html = generateIdCardHtml({
      fullName: 'Gaurav Patil',
      membershipNo: 'ACES-2026-9999',
      validUpto: '08/26',
    });

    assert.ok(html.includes('GAURAV PATIL'), 'HTML should contain uppercase student name');
    assert.ok(html.includes('ACES-2026-9999'), 'HTML should contain membership number');
    assert.ok(html.includes('08/26'), 'HTML should contain valid upto date');
    assert.ok(html.includes('data:image/png;base64,'), 'HTML should embed base64 image data');
    assert.ok(!html.includes('{{MEMBER_NAME}}'), 'Placeholders should be replaced');
    assert.ok(!html.includes('{{MEMBERSHIP_NO}}'), 'Placeholders should be replaced');
    assert.ok(!html.includes('{{VALID_UPTO}}'), 'Placeholders should be replaced');
  });

  it('should generate a valid PNG image buffer using Puppeteer', async () => {
    const buffer = await generateIdCardPng({
      fullName: 'Aditya Kulkarni',
      membershipNo: 'ACES-2026-1234',
      validUpto: '08/26',
    });

    assert.ok(Buffer.isBuffer(buffer), 'Output must be a Buffer');
    assert.ok(buffer.length > 10000, 'Output buffer must contain image data');

    // Verify PNG magic header bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50); // 'P'
    assert.equal(buffer[2], 0x4e); // 'N'
    assert.equal(buffer[3], 0x47); // 'G'
  });
});
