// src/api/client.js
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Adjust this if your backend URL is different in production
const BASE_URL = "https://api.kupwaracart.in";

const client = axios.create({
  baseURL: BASE_URL, // we'll always call paths like /api/...
  timeout: 15000,
});

// Paths that should NOT send Authorization header
const authFreePaths = [
  "delivery/login/",      // POST /api/delivery/login/
  // add more here later if needed, e.g. "delivery/register/"
];

// Attach JWT from AsyncStorage (deliveryToken) to requests,
// EXCEPT for authFreePaths
client.interceptors.request.use(
  async (config) => {
    try {
      const rawUrl = config.url || "";

      // Decide if we should skip auth for this request
      const skipAuth = authFreePaths.some((p) => rawUrl.includes(p));

      if (!skipAuth) {
        const token = await AsyncStorage.getItem("deliveryToken");
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      } else {
        // Make sure we do NOT send any stale Authorization header
        if (config.headers && config.headers.Authorization) {
          delete config.headers.Authorization;
        }
      }
    } catch (e) {
      console.log("Error handling deliveryToken in interceptor:", e);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

export default client;
