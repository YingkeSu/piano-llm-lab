import type {
  ApiResult,
  CommentListRequest,
  CommentListResponse,
  DeleteCommentRequest,
  LoginRequest,
  PublishCommentRequest,
  RegisterRequest,
  UserSession,
} from "@piano-llm-lab/shared-types";
import axios, { type InternalAxiosRequestConfig } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8787",
  withCredentials: true,
});

let csrfToken = "";
let csrfPromise: Promise<string> | null = null;

async function getCsrf(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  if (!csrfPromise) {
    csrfPromise = api
      .get<ApiResult<string>>("/api/csrf")
      .then((res: { data: ApiResult<string> }) => {
        if (!res.data.data) {
          throw new Error(res.data.msg || "Failed to get CSRF token");
        }
        csrfToken = res.data.data;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise as Promise<string>;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if ((config.method || "get").toLowerCase() === "post") {
    const token = await getCsrf();
    if (config.data && typeof config.data === "object" && !Array.isArray(config.data)) {
      (config.data as Record<string, unknown>)._csrf = token;
    } else {
      config.data = { _csrf: token };
    }
  }
  return config;
});

export async function fetchMe(): Promise<UserSession> {
  const res = await api.get<ApiResult<UserSession>>("/api/auth/me");
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.msg || "Failed to fetch session");
  }
  return res.data.data;
}

export async function register(payload: RegisterRequest): Promise<UserSession> {
  const res = await api.post<ApiResult<UserSession>>("/api/auth/register", payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.msg || "Register failed");
  }
  return res.data.data;
}

export async function login(payload: LoginRequest): Promise<UserSession> {
  const res = await api.post<ApiResult<UserSession>>("/api/auth/login", payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.msg || "Login failed");
  }
  return res.data.data;
}

export async function logout(): Promise<void> {
  const res = await api.post<ApiResult<{ loggedIn: boolean }>>("/api/auth/logout", {});
  if (!res.data.success) {
    throw new Error(res.data.msg || "Logout failed");
  }
}

export async function listComments(payload: CommentListRequest): Promise<CommentListResponse> {
  const res = await api.post<ApiResult<CommentListResponse>>("/api/pinlun/list", payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.msg || "Load comments failed");
  }
  return res.data.data;
}

export async function publishComment(payload: PublishCommentRequest): Promise<{ id: number; status: string }> {
  const res = await api.post<ApiResult<{ id: number; status: string }>>("/api/pinlun/publish", payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.msg || "Publish comment failed");
  }
  return res.data.data;
}

export async function deleteComment(payload: DeleteCommentRequest): Promise<void> {
  const res = await api.post<ApiResult<{ id: number }>>("/api/pinlun/del", payload);
  if (!res.data.success) {
    throw new Error(res.data.msg || "Delete comment failed");
  }
}
