export interface SafeUser {
  id: string;
  name: string;
  avatar: string | null;
}
export interface RegisterResponse {
  user: SafeUser;
}
export interface LoginResponse {
  user: SafeUser;
}
export interface SessionResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  accessMaxAge: number;
  refreshMaxAge: number;
}
