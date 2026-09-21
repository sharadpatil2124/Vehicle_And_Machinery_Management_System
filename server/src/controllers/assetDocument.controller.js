const assetDocumentService = require('../services/assetDocument.service');
const storage = require('../services/storage.service');

async function list(req, res) {
  const data = await assetDocumentService.listDocuments({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
  });
  res.status(200).json({ data, message: 'Documents retrieved' });
}

async function upload(req, res) {
  const data = await assetDocumentService.uploadDocument({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
    docType: req.params.docType?.toUpperCase(),
    actingUserId: req.auth.userId,
    file: req.file,
  });
  res.status(200).json({ data, message: 'Document uploaded' });
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function download(req, res) {
  const doc = await assetDocumentService.getDocumentForDownload({
    tenantId: req.auth.tenantId, auth: req.auth,
    assetType: req.params.assetType?.toUpperCase(),
    assetId: req.params.assetId,
    docType: req.params.docType?.toUpperCase(),
  });

  res.setHeader('Content-Type', doc.mimeType);
  res.setHeader('Content-Length', doc.fileSize);
  res.setHeader('Content-Disposition', contentDisposition(doc.originalFilename));

  const stream = storage.readFileStream(doc.storedFilename);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Could not read the stored file' });
    } else {
      res.destroy();
    }
  });
  stream.pipe(res);
}

module.exports = { list, upload, download };
