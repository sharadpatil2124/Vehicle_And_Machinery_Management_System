import { readToken, clearSession } from './session';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export const SESSION_EXPIRED_EVENT = 'vmms:session-expired';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  const headers = { Accept: 'application/json' };
  const token = readToken();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const payload = await readBody(response);

  if (response.ok) return payload;

  if (response.status === 401 && token) {
    clearSession();
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }

  throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
};

export const authApi = {
  signUp: (payload) => api.post('/auth/signup', payload),
  logIn: (payload) => api.post('/auth/login', payload),
  logOut: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  requestPasswordReset: (payload) => api.post('/auth/forgot-password', payload),
  checkResetToken: (token) => api.get(`/auth/reset-password?token=${encodeURIComponent(token)}`),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
};

export const usersApi = {
  list: () => api.get('/users'),
  createSupervisor: (payload) => api.post('/users/supervisors', payload),
  updateSupervisor: (id, payload) => api.put(`/users/supervisors/${id}`, payload),
  setSupervisorStatus: (id, status) => api.patch(`/users/supervisors/${id}/status`, { status }),
};

function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function createAssetWithDocuments(path, payload, files = {}) {
  const headers = { Accept: 'application/json' };
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const form = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    form.append(key, key === 'compliance' ? JSON.stringify(value) : value);
  }
  for (const [docType, file] of Object.entries(files)) {
    if (file) form.append(docType, file);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const responseBody = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, responseBody?.error ?? `Request failed (${response.status})`);
  }
  return responseBody;
}

export const vehiclesApi = {
  list: (params) => api.get(`/vehicles${toQueryString(params)}`),
  get: (id) => api.get(`/vehicles/${id}`),
  create: (payload, files) => createAssetWithDocuments('/vehicles', payload, files),
  update: (id, payload) => api.put(`/vehicles/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/vehicles/${id}`, { confirmation }),
  restore: (id) => api.post(`/vehicles/${id}/restore`),
  history: (id) => api.get(`/vehicles/${id}/history`),
};

async function uploadAssetDocument(assetType, assetId, docType, file) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    const form = new FormData();
    form.append('file', file);
    response = await fetch(`${BASE_URL}/documents/${assetType}/${assetId}/${docType}`, {
      method: 'POST',
      headers,
      body: form,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  const payload = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

async function downloadAssetDocument(assetType, assetId, docType, suggestedFilename) {
  const headers = {};
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}/documents/${assetType}/${assetId}/${docType}/download`, { headers });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the API is running.');
  }

  if (!response.ok) {
    const payload = await readBody(response);
    throw new ApiError(response.status, payload?.error ?? `Request failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedFilename || 'document';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const assetDocumentsApi = {
  list: (assetType, assetId) => api.get(`/documents/${assetType}/${assetId}`),
  upload: uploadAssetDocument,
  download: downloadAssetDocument,
};

export const machineryApi = {
  list: (params) => api.get(`/machinery${toQueryString(params)}`),
  get: (id) => api.get(`/machinery/${id}`),
  create: (payload, files) => createAssetWithDocuments('/machinery', payload, files),
  update: (id, payload) => api.put(`/machinery/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/machinery/${id}`, { confirmation }),
  restore: (id) => api.post(`/machinery/${id}/restore`),
  history: (id) => api.get(`/machinery/${id}/history`),
};

export const sitesApi = {
  list: (params) => api.get(`/sites${toQueryString(params)}`),
  get: (id) => api.get(`/sites/${id}`),
  assets: (id) => api.get(`/sites/${id}/assets`),
  create: (payload) => api.post('/sites', payload),
  update: (id, payload) => api.put(`/sites/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/sites/${id}`, { confirmation }),
  restore: (id) => api.post(`/sites/${id}/restore`),
};

export const siteAssignmentsApi = {
  history: (assetType, assetId) => api.get(`/site-assignments/${assetType}/${assetId}`),
};

export const complianceApi = {
  list: (assetType, assetId) => api.get(`/compliance/${assetType}/${assetId}`),
  save: (assetType, assetId, docType, payload) =>
    api.put(`/compliance/${assetType}/${assetId}/${docType}`, payload),
};

export const itemCategoriesApi = {
  list: (params) => api.get(`/item-categories${toQueryString(params)}`),
  get: (id) => api.get(`/item-categories/${id}`),
  create: (payload) => api.post('/item-categories', payload),
  update: (id, payload) => api.put(`/item-categories/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/item-categories/${id}`, { confirmation }),
  restore: (id) => api.post(`/item-categories/${id}/restore`),
};

export const unitsOfMeasureApi = {
  list: (params) => api.get(`/units-of-measure${toQueryString(params)}`),
  get: (id) => api.get(`/units-of-measure/${id}`),
  create: (payload) => api.post('/units-of-measure', payload),
  update: (id, payload) => api.put(`/units-of-measure/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/units-of-measure/${id}`, { confirmation }),
  restore: (id) => api.post(`/units-of-measure/${id}/restore`),
};

export const itemsApi = {
  list: (params) => api.get(`/items${toQueryString(params)}`),
  get: (id) => api.get(`/items/${id}`),
  create: (payload) => api.post('/items', payload),
  update: (id, payload) => api.put(`/items/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/items/${id}`, { confirmation }),
  restore: (id) => api.post(`/items/${id}/restore`),
};

export const suppliersApi = {
  list: (params) => api.get(`/suppliers${toQueryString(params)}`),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (payload) => api.post('/suppliers', payload),
  update: (id, payload) => api.put(`/suppliers/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/suppliers/${id}`, { confirmation }),
  restore: (id) => api.post(`/suppliers/${id}/restore`),
};

export const storageLocationsApi = {
  list: (params) => api.get(`/storage-locations${toQueryString(params)}`),
  get: (id) => api.get(`/storage-locations/${id}`),
  create: (payload) => api.post('/storage-locations', payload),
  update: (id, payload) => api.put(`/storage-locations/${id}`, payload),
  remove: (id, confirmation) => api.delete(`/storage-locations/${id}`, { confirmation }),
  restore: (id) => api.post(`/storage-locations/${id}/restore`),
};

export const purchasesApi = {
  list: (params) => api.get(`/purchases${toQueryString(params)}`),
  get: (id) => api.get(`/purchases/${id}`),
  create: (payload) => api.post('/purchases', payload),
  update: (id, payload) => api.put(`/purchases/${id}`, payload),
  receive: (id, payload) => api.post(`/purchases/${id}/receive`, payload),
};

export const stockApi = {
  balances: (params) => api.get(`/stock/balances${toQueryString(params)}`),
  transactions: (params) => api.get(`/stock/transactions${toQueryString(params)}`),
};

export const assetIssuesApi = {
  list: (params) => api.get(`/asset-issues${toQueryString(params)}`),
  get: (id) => api.get(`/asset-issues/${id}`),
  create: (payload) => api.post('/asset-issues', payload),
};

export const issueReversalsApi = {
  get: (id) => api.get(`/issue-reversals/${id}`),
  create: (payload) => api.post('/issue-reversals', payload),
};

export const stockAdjustmentsApi = {
  list: (params) => api.get(`/stock-adjustments${toQueryString(params)}`),
  get: (id) => api.get(`/stock-adjustments/${id}`),
  create: (payload) => api.post('/stock-adjustments', payload),
};

export const stockTransfersApi = {
  list: (params) => api.get(`/stock-transfers${toQueryString(params)}`),
  get: (id) => api.get(`/stock-transfers/${id}`),
  create: (payload) => api.post('/stock-transfers', payload),
  receive: (id) => api.post(`/stock-transfers/${id}/receive`),
};
