/**
 * User ID Management Utility
 * 
 * In online mode: returns the authenticated user's ID from JWT.
 * In offline mode: generates and persists a userId in localStorage.
 */

const USER_ID_KEY = 'learnos_user_id';
const ACCESS_TOKEN_KEY = 'access_token';

/**
 * Decode JWT payload without verification (client-side only)
 */
function decodeJwtPayload(token: string): any {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Get the current user ID.
 * - If logged in (JWT exists): returns the JWT subject (user UUID)
 * - If not logged in: returns a persistent localStorage-based ID (offline mode)
 */
export function getUserId(): string {
  if (typeof window === 'undefined') {
    return 'demo_user';
  }

  // Check for JWT token first (online/authenticated mode)
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload?.sub) {
      return payload.sub;
    }
  }

  // Fallback: offline mode — generate persistent local ID
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

/**
 * Check if user is authenticated (has valid JWT)
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 > Date.now();
}

/**
 * Get access token for API calls
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Clear the stored user ID (useful for testing)
 */
export function clearUserId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_ID_KEY);
  }
}

/**
 * Set a specific user ID (useful for testing)
 */
export function setUserId(userId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_ID_KEY, userId);
  }
}
