export interface ApiResult<T> {
  success: boolean;
  data?: T;
  msg?: string;
  code?: string;
}

export interface UserSession {
  id: number;
  username: string;
  nickname: string;
  role: "user" | "admin";
  loggedIn: boolean;
}

export interface CommentRecord {
  id: number;
  content: string;
  createdAt: string;
  user: {
    id: number | null;
    nickname: string;
    username?: string;
    self: boolean;
    isAdmin: boolean;
  };
  status: "approved" | "pending";
}

export interface CommentListRequest {
  id: string;
  pageIndex: number;
  q?: string;
}

export interface CommentListResponse {
  list: CommentRecord[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nickname: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PublishCommentRequest {
  id: string;
  text: string;
  nickname?: string;
  anonymous?: boolean;
}

export interface DeleteCommentRequest {
  id: number;
}
