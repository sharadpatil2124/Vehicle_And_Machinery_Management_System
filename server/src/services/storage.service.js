const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const env = require('../config/env');

function resolveKey(key) {
  const resolved = path.resolve(env.upload.dir, key);
  const root = path.resolve(env.upload.dir) + path.sep;
  if (!resolved.startsWith(root)) {
    throw new Error(`storage: resolved path escapes the storage root ("${key}")`);
  }
  return resolved;
}

function buildKey(tenantId, assetType, assetId, docType, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const random = crypto.randomBytes(16).toString('hex');
  return path.posix.join(tenantId, assetType, assetId, `${docType}-${random}${ext}`);
}

async function saveFile(key, buffer) {
  const fullPath = resolveKey(key);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  await fsp.writeFile(fullPath, buffer);
}

async function deleteFile(key) {
  await fsp.rm(resolveKey(key), { force: true });
}

function readFileStream(key) {
  return fs.createReadStream(resolveKey(key));
}

module.exports = { buildKey, saveFile, deleteFile, readFileStream };
