import axios from 'axios';
import { getAccessToken, setAccessToken } from './token.js';

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const url = config.url || '';
    if (error.response?.status !== 401 || config._retry || url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return Promise.reject(error);
    }
    config._retry = true;
    try {
      refreshPromise = refreshPromise || http.post('/auth/refresh').finally(() => {
        refreshPromise = null;
      });
      const { data } = await refreshPromise;
      setAccessToken(data.data.accessToken);
      config.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return http(config);
    } catch (refreshError) {
      setAccessToken(null);
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
      return Promise.reject(refreshError);
    }
  },
);

export const api = {
  get: (url, params, config = {}) => http.get(url, { params, signal: config.signal }).then((res) => res.data),
  post: (url, body) => http.post(url, body).then((res) => res.data),
  patch: (url, body) => http.patch(url, body).then((res) => res.data),
  delete: (url, body) => http.delete(url, { data: body }).then((res) => res.data),
};

const viewableByExtension = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

function displayType(mimeType, filename) {
  const header = String(mimeType || '').split(';')[0].trim().toLowerCase();
  const extension = (String(filename || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/) || [])[1] || '';
  if (header && header !== 'application/octet-stream') return header;
  return viewableByExtension[extension] || header || 'application/octet-stream';
}

export async function loadProtectedFile(path, { mimeType, filename } = {}) {
  const response = await http.get(path, { responseType: 'blob' });
  const type = displayType(mimeType || response.headers['content-type'], filename);
  const url = URL.createObjectURL(new Blob([response.data], { type }));
  return { url, type };
}

export async function openProtectedFile(path, { downloadName, mimeType, filename } = {}) {
  const preview = downloadName ? null : window.open('', '_blank');
  if (preview) {
    preview.document.title = filename || 'Document';
    preview.document.body.innerHTML = '<p style="font-family:Segoe UI,sans-serif;padding:24px">Opening document…</p>';
  }
  const response = await http.get(path, { responseType: 'blob' });
  const type = displayType(mimeType || response.headers['content-type'], filename || downloadName);
  const url = URL.createObjectURL(new Blob([response.data], { type }));
  if (downloadName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
  } else if (preview) {
    const title = String(filename || 'Document').replace(/[<>"']/g, '');
    const frame = type.startsWith('image/')
      ? `<img alt="${title}" src="${url}" style="max-width:100%;height:auto;display:block;margin:auto" />`
      : `<iframe title="${title}" src="${url}" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>`;
    preview.document.title = title;
    preview.document.body.innerHTML = frame;
    preview.document.body.style.margin = '0';
  } else {
    window.open(url, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

export function openProtectedPdf(path, options) {
  return openProtectedFile(path, options);
}
