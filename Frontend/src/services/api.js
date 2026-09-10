import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartinspect_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      if (!error.config?.url?.includes("/auth/login")) {
        localStorage.removeItem("smartinspect_token");
      }
    }
    return Promise.reject(error);
  }
);

export const unwrap = (response) => response?.data?.data ?? response?.data ?? null;

export const apiError = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  error?.message ||
  "Something went wrong.";

export default api;
