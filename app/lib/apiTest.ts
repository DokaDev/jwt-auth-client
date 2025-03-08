import { AuthTokens } from "../types/auth";
import { refreshTestToken } from "./auth";

// API 기본 URL (실제 환경에서는 환경 변수로 관리)
const API_BASE_URL = 'http://localhost:8080/api';

// API 엔드포인트 정의
export enum ApiEndpoint {
  PUBLIC = 'public',
  PROTECTED = 'protected',
  ADMIN = 'admin'
}

// API 응답 타입
export interface ApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  tokenRefreshed?: boolean;
  newTokens?: AuthTokens;
}

/**
 * API 요청을 실행합니다.
 * @param endpoint API 엔드포인트
 * @param accessToken 액세스 토큰 (옵셔널, PUBLIC 엔드포인트는 불필요)
 * @param refreshToken 리프레시 토큰 (토큰 갱신에 사용)
 */
export const callTestApi = async (
  endpoint: ApiEndpoint,
  accessToken?: string,
  refreshToken?: string
): Promise<ApiResponse> => {
  console.log(`[API] Calling ${endpoint} API endpoint`);

  const url = `${API_BASE_URL}/${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json' };

  // 토큰이 있는 경우 헤더에 추가
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // PUBLIC 엔드포인트는 인증 필요 없음
  if (endpoint === ApiEndpoint.PUBLIC) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log('[API] Public endpoint accessed successfully');
        return {
          success: true,
          data: await response.json()
        };
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('[API] Error accessing public endpoint:', error);
      return {
        success: false,
        error: 'Failed to access public endpoint'
      };
    }
  }

  // 보호된 엔드포인트는 토큰 필요
  if (!accessToken) {
    console.error('[API] Token required for protected endpoints');
    return {
      success: false,
      error: 'Authentication required'
    };
  }

  try {
    const response = await fetch(url, { headers });

    // 401 Unauthorized 응답 시 토큰 갱신 시도
    if (response.status === 401 && refreshToken) {
      console.log('[API] Access token rejected, attempting to refresh');
      try {
        // 리프레시 토큰을 사용하여 새 토큰 발급
        const newTokens = await refreshTestToken(refreshToken);
        console.log('[API] Token refreshed successfully');

        // 새 토큰으로 재시도
        const newHeaders = { ...headers, 'Authorization': `Bearer ${newTokens.accessToken}` };
        const retryResponse = await fetch(url, { headers: newHeaders });

        if (retryResponse.ok) {
          console.log('[API] API call successful with refreshed token');
          return {
            success: true,
            data: await retryResponse.json(),
            tokenRefreshed: true,
            newTokens
          };
        } else {
          throw new Error(`API error after token refresh: ${retryResponse.status}`);
        }
      } catch (refreshError) {
        console.error('[API] Token refresh failed:', refreshError);
        return {
          success: false,
          error: 'Token refresh failed'
        };
      }
    }

    // 원래 요청이 성공한 경우
    if (response.ok) {
      console.log(`[API] ${endpoint} endpoint accessed successfully`);
      return {
        success: true,
        data: await response.json()
      };
    }

    // 403 Forbidden - 권한 부족
    if (response.status === 403) {
      console.error('[API] Forbidden - insufficient permissions');
      return {
        success: false,
        error: 'Insufficient permissions'
      };
    }

    throw new Error(`API error: ${response.status}`);
  } catch (error) {
    console.error(`[API] Error accessing ${endpoint} endpoint:`, error);
    return {
      success: false,
      error: `Failed to access ${endpoint} endpoint`
    };
  }
}; 