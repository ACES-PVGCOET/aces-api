import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { uploadSingle } from '../shared/middleware/uploadMiddleware.js';

describe('Upload Middleware Unit Tests', () => {
  const createTestApp = (options) => {
    const app = express();
    app.post('/test-upload', uploadSingle('file', options), (req, res) => {
      res.status(200).json({
        success: true,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
        size: req.file.size,
      });
    });

    // Error handling middleware
    app.use((err, _req, res, _next) => {
      res.status(err.statusCode || 400).json({
        success: false,
        error: {
          code: err.code || 'INVALID_INPUT',
          message: err.message,
        },
      });
    });

    return app;
  };

  const uploadFile = async (app, fileName, mimeType, content = 'dummy content') => {
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    try {
      const formData = new FormData();
      const blob = new Blob([content], { type: mimeType });
      formData.append('file', blob, fileName);

      const res = await fetch(`http://localhost:${port}/test-upload`, {
        method: 'POST',
        body: formData,
      });

      const body = await res.json();
      return { status: res.status, body };
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  };

  it('should accept video/mp4 when allowedMimeTypes is null (e.g. forms upload)', async () => {
    const app = createTestApp({ maxSizeMB: 100, allowedMimeTypes: null });
    const res = await uploadFile(app, 'clip.mp4', 'video/mp4');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.mimetype, 'video/mp4');
    assert.equal(res.body.originalname, 'clip.mp4');
  });

  it('should reject video/mp4 with 400 when default options (images only) are used', async () => {
    const app = createTestApp();
    const res = await uploadFile(app, 'clip.mp4', 'video/mp4');

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.message.includes("Invalid file type 'video/mp4'"));
    assert.ok(res.body.error.message.includes('image/jpeg, image/png, image/webp, image/gif'));
  });

  it('should accept image files when default options are used', async () => {
    const app = createTestApp();
    const res = await uploadFile(app, 'photo.png', 'image/png');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.mimetype, 'image/png');
  });

  it('should accept video/mp4 when allowedMimeTypes specifies video wildcard video/*', async () => {
    const app = createTestApp({ allowedMimeTypes: ['video/*'] });
    const res = await uploadFile(app, 'clip.mp4', 'video/mp4');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('should reject application/pdf when allowedMimeTypes is video/*', async () => {
    const app = createTestApp({ allowedMimeTypes: ['video/*'] });
    const res = await uploadFile(app, 'doc.pdf', 'application/pdf');

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes("Invalid file type 'application/pdf'"));
  });

  it('should include accurate maxSizeMB in error message when size is exceeded', async () => {
    // 0.001 MB limit ~ 1048 bytes limit
    const app = createTestApp({ maxSizeMB: 0.001, allowedMimeTypes: null });
    const largeContent = 'A'.repeat(50000);
    const res = await uploadFile(app, 'clip.mp4', 'video/mp4', largeContent);

    assert.equal(res.status, 400);
    assert.ok(res.body.error.message.includes('File size exceeds maximum limit of 0.001MB.'));
  });
});
