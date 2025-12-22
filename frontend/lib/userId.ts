/**
 * User ID Management Utility
 * 
 * In production, this would be replaced with proper authentication.
 * For now, we generate and persist a userId in localStorage.
 */

const USER_ID_KEY = 'learnos_user_id';

/**
 * Get or create a consistent user ID
 */
export function getUserId(): string {
  // Check if we're in the browser
  if (typeof window === 'undefined') {
    return 'demo_user';
  }

  // Try to get existing userId from localStorage
  let userId = localStorage.getItem(USER_ID_KEY);

  // If no userId exists, create one
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }

  return userId;
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
