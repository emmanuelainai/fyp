import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:5000";

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
};

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("examsentinel.token");
      localStorage.removeItem("examsentinel.user");
      setAuthToken(null);
    }
    return Promise.reject(error);
  }
);

export const apiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const fieldErrors = data?.errors?.fieldErrors as Record<string, string[] | undefined> | undefined;
    const formErrors = data?.errors?.formErrors as string[] | undefined;
    const details = [
      ...(formErrors ?? []),
      ...Object.entries(fieldErrors ?? {}).flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`))
    ];
    return details.length ? `${data?.message ?? "Validation failed"}: ${details.join("; ")}` : data?.message ?? error.message;
  }
  return error instanceof Error ? error.message : "Unexpected error";
};
