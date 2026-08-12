import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cosmic_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('cosmic_token');
      localStorage.removeItem('cosmic_user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const mediaUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '');
  return `${base}${path}`;
};

// The Socket.IO signaling server lives on the same host as the REST API,
// just without the /api suffix — e.g. VITE_API_URL=https://api.example.com/api
// -> socket at https://api.example.com. Falls back to same-origin in dev,
// where Vite proxies /api and Socket.IO connects to the page's own host.
export const socketUrl = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '') || undefined;

export default api;
