"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthTokens } from '@/app/types/auth';
import { loginTest, verifyJwt, decodeJwt, refreshTestToken, getRemainingTime, logoutTest } from '@/app/lib/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  tokens: AuthTokens | null;
  setTokens: (tokens: AuthTokens) => void;
}

// Default context value
const defaultAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  logout: () => {},
  tokens: null,
  setTokens: () => {}
};

// Create auth context
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Custom hook for using auth context
export const useAuth = () => useContext(AuthContext);

// Local storage keys (for testing)
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

// Token refresh interval (in milliseconds)
const TOKEN_REFRESH_INTERVAL = 15 * 1000; // 15 seconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 토큰 상태 업데이트 및 저장 함수 (외부에서 호출 가능)
  const updateTokens = (newTokens: AuthTokens) => {
    console.log('[AUTH] Updating tokens in context');
    setTokens(newTokens);
    
    // 로컬 스토리지에 토큰 저장
    localStorage.setItem(ACCESS_TOKEN_KEY, newTokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, newTokens.refreshToken);
    
    // 토큰에서 사용자 정보 추출
    try {
      const payload = decodeJwt(newTokens.accessToken);
      const userData: User = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role
      };
      setUser(userData);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
    } catch (error) {
      console.error('[AUTH] Error decoding token:', error);
    }
  };
  
  // Log token status
  const logTokenStatus = (accessToken: string | null, refreshToken: string | null) => {
    console.log('[TOKEN_STATUS] Checking tokens...');
    
    if (!accessToken) {
      console.log('[TOKEN_STATUS] No access token found');
    } else {
      const accessRemaining = getRemainingTime(accessToken);
      console.log(`[TOKEN_STATUS] Access Token: ${accessRemaining} seconds remaining`);
    }
    
    if (!refreshToken) {
      console.log('[TOKEN_STATUS] No refresh token found');
    } else {
      const refreshRemaining = getRemainingTime(refreshToken);
      console.log(`[TOKEN_STATUS] Refresh Token: ${refreshRemaining} seconds remaining`);
    }
  };
  
  // Load tokens and user info from local storage (for testing)
  const loadAuthState = () => {
    console.log('[AUTH] Loading authentication state');
    
    if (typeof window !== 'undefined') {
      try {
        // Get tokens from storage
        const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);
        
        console.log('[AUTH] Tokens from storage:', accessToken ? 'Access token found' : 'No access token', refreshToken ? 'Refresh token found' : 'No refresh token');
        logTokenStatus(accessToken, refreshToken);
        
        // 액세스 토큰이 있고 유효한 경우
        if (accessToken && getRemainingTime(accessToken) > 0 && savedUser) {
          console.log('[AUTH] Access token is valid, setting user state');
          setTokens({ 
            accessToken, 
            refreshToken: refreshToken || '' 
          });
          setUser(JSON.parse(savedUser));
          return true;
        } 
        // 액세스 토큰은 만료됐지만 리프레시 토큰이 있는 경우
        else if (refreshToken && getRemainingTime(refreshToken) > 0) {
          console.log('[AUTH] Access token invalid/expired but refresh token valid, refreshing tokens');
          // 비동기 처리를 시작하고 일단 true 반환 (리프레시는 백그라운드에서 진행)
          refreshTokens(refreshToken);
          return true;
        }
        
        console.log('[AUTH] No valid tokens found or tokens expired');
        clearAuthState(); // 모든 토큰이 유효하지 않으면 인증 상태 초기화
      } catch (error) {
        console.error('[AUTH] Failed to load auth state:', error);
        clearAuthState();
      }
    }
    return false;
  };
  
  // Token refresh function - 수정
  const refreshTokens = async (refreshToken: string) => {
    console.log('[AUTH] Starting token refresh process');
    try {
      const newTokens = await refreshTestToken(refreshToken);
      console.log('[AUTH] Token refresh successful, updating tokens');
      updateTokens(newTokens);
      return true;
    } catch (error) {
      console.error('[AUTH] Failed to refresh token:', error);
      clearAuthState();
      return false;
    }
  };
  
  // Login function
  const login = async (email: string, password: string) => {
    console.log('[AUTH] Login attempt initiated');
    setLoading(true);
    try {
      // Call test login function
      const { tokens: authTokens } = await loginTest({ email, password });
      
      // Update state using the new function
      updateTokens(authTokens);
      console.log('[AUTH] User state updated after login');
    } catch (error) {
      console.error('[AUTH] Login failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  // Logout function
  const logout = () => {
    console.log('[AUTH] Logout initiated');
    
    // 서버에 로그아웃 요청 전송
    if (tokens?.accessToken && user?.id) {
      console.log('[AUTH] Sending logout request to server');
      logoutTest(tokens.accessToken, user.id)
        .then(() => {
          console.log('[AUTH] Server logout successful');
        })
        .catch(error => {
          console.error('[AUTH] Server logout failed:', error);
        })
        .finally(() => {
          clearAuthState();
        });
    } else {
      console.log('[AUTH] No tokens/user to logout on server');
      clearAuthState();
    }
  };
  
  // Clear auth state
  const clearAuthState = () => {
    console.log('[AUTH] Clearing authentication state');
    setUser(null);
    setTokens(null);
    
    // Remove from local storage
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    console.log('[AUTH] All tokens removed from storage');
  };
  
  // Check token status periodically
  const checkTokenStatus = () => {
    if (tokens?.accessToken) {
      console.log('[TOKEN_CHECK] Periodic token status check');
      logTokenStatus(tokens.accessToken, tokens.refreshToken);
      
      // Auto-refresh if access token is about to expire (less than 10 seconds remaining)
      const accessRemaining = getRemainingTime(tokens.accessToken);
      if (accessRemaining < 10 && tokens.refreshToken) {
        console.log('[TOKEN_CHECK] Access token expiring soon, attempting refresh');
        refreshTokens(tokens.refreshToken);
      }
    }
  };
  
  // Load auth state on component mount
  useEffect(() => {
    console.log('[AUTH] Auth provider initialized');
    const isAuthenticated = loadAuthState();
    setLoading(false);
    
    // 새로고침 시에도 토큰 체크를 수행
    if (isAuthenticated) {
      // 즉시 토큰 상태 확인
      setTimeout(checkTokenStatus, 1000);
      
      // 주기적 토큰 체크 설정
      console.log(`[AUTH] Setting up token check interval (${TOKEN_REFRESH_INTERVAL/1000}s)`);
      const refreshInterval = setInterval(checkTokenStatus, TOKEN_REFRESH_INTERVAL);
      
      return () => {
        console.log('[AUTH] Clearing token check interval');
        clearInterval(refreshInterval);
      };
    }
  }, []);
  
  // Context value to provide
  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    tokens,
    setTokens: updateTokens
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 