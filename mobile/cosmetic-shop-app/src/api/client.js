// src/api/client.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use different base URLs for dev (localhost) and production (Render)
const BASE_URL = 'https://api.kupwaracart.in';

console.log('API BASE_URL =>', BASE_URL);

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// ---- GLOBAL NETWORK ERROR HANDLER HOOK ----
let onNetworkErrorChange = null;

/**
 * Register a global network error handler.
 * handler(hasError: boolean, error?: any)
 */
export const setNetworkErrorHandler = (handler) => {
  onNetworkErrorChange = handler;
};

// Attach JWT from AsyncStorage.userInfo.token (same as your web app uses)
// AND normalize URL so both 'home/' and '/api/home/' work.
client.interceptors.request.use(
  async (config) => {
    // ----- Decide if this request should send auth or not -----
    const rawUrl = config.url || '';

    const authFreePaths = [
      'users/register/send-otp/',
      'users/register/verify-otp/',
      'users/login/', // your login endpoint
    ];

    const skipAuth = authFreePaths.some((p) => rawUrl.includes(p));

    // ----- Auth header -----
    if (!skipAuth) {
      try {
        const raw = await AsyncStorage.getItem('userInfo');
        if (raw) {
          const userInfo = JSON.parse(raw);
          if (userInfo?.token) {
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${userInfo.token}`;
          }
        }
      } catch (e) {
        // ignore token errors
      }
    } else {
      // Make sure we do NOT send any stale Authorization header
      if (config.headers && config.headers.Authorization) {
        delete config.headers.Authorization;
      }
    }

    // ----- URL normalization -----
    let url = config.url || '';

    // If it's an absolute URL (http/https), don't touch it
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      // If it starts with "/", it's a root-relative path
      if (url.startsWith('/')) {
        // If it's already under /api/, keep it
        if (!url.startsWith('/api/')) {
          // e.g. "/home/" -> "/api/home/"
          url = '/api' + url;
        }
      } else {
        // No leading slash: "home/" or "api/products/"
        if (url.startsWith('api/')) {
          // "api/products/" -> "/api/products/"
          url = '/' + url;
        } else {
          // "home/" -> "/api/home/"
          url = '/api/' + url;
        }
      }

      config.url = url;
    }

    if (config.url.startsWith('/api/api/')) {
      config.url = config.url.replace('/api/api/', '/api/');
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ---- RESPONSE INTERCEPTOR: detect "Network Error" ----
client.interceptors.response.use(
  (response) => {
    // Any successful response means network is OK
    if (onNetworkErrorChange) {
      onNetworkErrorChange(false, null);
    }
    return response;
  },
  (error) => {
    const hasHttpResponse = !!error.response;

    // We only treat errors *without* a server response as "network" issues:
    // - server down
    // - DNS / connect error
    // - timeout
    if (!hasHttpResponse && onNetworkErrorChange) {
      onNetworkErrorChange(true, error);
    }

    return Promise.reject(error);
  }
);

export default client;
