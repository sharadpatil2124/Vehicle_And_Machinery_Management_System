const brandingService = require('../services/branding.service');
const storage = require('../services/storage.service');

async function get(req, res) {
  const data = await brandingService.getBranding({ tenantId: req.auth.tenantId });
  res.status(200).json({ data, message: 'Branding retrieved' });
}

async function updateTitle(req, res) {
  const data = await brandingService.updateTitle({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    dashboardTitle: req.body?.dashboardTitle,
  });
  res.status(200).json({ data, message: 'Dashboard title updated' });
}

async function uploadLogo(req, res) {
  const data = await brandingService.uploadLogo({
    tenantId: req.auth.tenantId,
    actingUserId: req.auth.userId,
    file: req.file,
  });
  res.status(200).json({ data, message: 'Logo uploaded' });
}

async function removeLogo(req, res) {
  const data = await brandingService.removeLogo({ tenantId: req.auth.tenantId, actingUserId: req.auth.userId });
  res.status(200).json({ data, message: 'Logo removed' });
}

async function downloadLogo(req, res) {
  const logo = await brandingService.getLogoForDownload({ tenantId: req.auth.tenantId });

  res.setHeader('Content-Type', logo.mimeType);
  res.setHeader('Cache-Control', 'private, max-age=86400');

  const stream = storage.readFileStream(logo.key);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not read the stored logo' });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

module.exports = { get, updateTitle, uploadLogo, removeLogo, downloadLogo };
