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
  get: (url, params) => http.get(url, { params }).then((res) => res.data),
  post: (url, body) => http.post(url, body).then((res) => res.data),
  patch: (url, body) => http.patch(url, body).then((res) => res.data),
  delete: (url, body) => http.delete(url, { data: body }).then((res) => res.data),
};

export async function openProtectedFile(path, { downloadName, mimeType } = {}) {
  const response = await http.get(path, { responseType: 'blob' });
  const type = mimeType || response.headers['content-type'] || 'application/octet-stream';
  const url = URL.createObjectURL(new Blob([response.data], { type }));
  if (downloadName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
  } else {
    window.open(url, '_blank', 'noopener');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function openProtectedPdf(path, options) {
  return openProtectedFile(path, options);
}
