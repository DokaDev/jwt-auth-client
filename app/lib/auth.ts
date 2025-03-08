import { User, AuthTokens, LoginCredentials, JwtPayload, AuthResponse } from '../types/auth';

// API 기본 URL (실제 환경에서는 환경 변수로 관리)
const API_BASE_URL = 'http://localhost:8080/api';

// 토큰 갱신 최소 시간 (초)
const TOKEN_REFRESH_THRESHOLD = 10; // 만료 10초 전에 갱신

// 토큰 스토리지 키
export const ACCESS_TOKEN_KEY = 'access_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const USER_KEY = 'auth_user';

/**
 * JWT 토큰에서 payload를 추출합니다.
 * @param token JWT 토큰
 * @returns JWT payload
 */
export const decodeJwt = (token: string): JwtPayload => {
  try {
    // JWT는 header.payload.signature 형식이므로 payload 부분만 추출
    const base64Payload = token.split('.')[1];
    // base64 디코딩
    const payload = JSON.parse(atob(base64Payload));
    return payload as JwtPayload;
  } catch (error) {
    console.error('[AUTH] Token decode error:', error);
    throw new Error('Invalid token format');
  }
};

/**
 * JWT 토큰의 유효성을 서버에 확인합니다.
 * @param token 검증할 JWT 토큰
 * @returns 유효하면 true, 그렇지 않으면 false
 */
export const verifyJwt = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.valid;
  } catch (error) {
    console.error('[AUTH] Token verification error:', error);
    return false;
  }
};

/**
 * 테스트 계정으로 로그인합니다.
 * @param credentials 로그인 자격증명
 * @returns 인증 응답 (사용자 정보 및 토큰)
 */
export const loginTest = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      throw new Error('Login failed');
    }

    return await response.json();
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    throw error;
  }
};

/**
 * 리프레시 토큰을 사용하여 액세스 토큰을 갱신합니다.
 * @param refreshToken 리프레시 토큰
 * @returns 새로운 토큰 쌍
 */
export const refreshTestToken = async (refreshToken: string): Promise<AuthTokens> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    return await response.json();
  } catch (error) {
    console.error('[AUTH] Token refresh error:', error);
    throw error;
  }
};

/**
 * 토큰에서 만료까지 남은 시간(초)을 계산합니다.
 * @param token JWT 토큰
 * @returns 만료까지 남은 시간(초)
 */
export const getRemainingTime = (token: string): number => {
  try {
    const payload = decodeJwt(token);
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  } catch {
    return 0;
  }
};

/**
 * 로그아웃 처리를 합니다.
 * @param accessToken 접근 토큰
 * @param userId 사용자 ID
 */
export const logoutTest = async (accessToken: string, userId: string): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ accessToken, userId })
    });
  } catch (error) {
    console.error('[AUTH] Logout error:', error);
  }
};

/**
 * 토큰에서 사용자 정보를 가져옵니다.
 * @param token JWT 토큰
 * @returns 사용자 정보
 */
export const getUserFromToken = async (token: string): Promise<User> => {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    return await response.json();
  } catch (error) {
    console.error('[AUTH] Get user error:', error);
    throw error;
  }
};

/**
 * 토큰이 곧 만료되는지 확인합니다.
 * @param token JWT 토큰
 * @returns 만료 임계값보다 작으면 true, 그렇지 않으면 false
 */
export const isTokenExpiringSoon = (token: string): boolean => {
  const remainingTime = getRemainingTime(token);
  return remainingTime < TOKEN_REFRESH_THRESHOLD;
}; 