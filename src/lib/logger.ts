/**
 * Centralized logging utility to reduce console noise during disconnection
 * and protect sensitive information like database URLs.
 */

const DB_URL_REGEX = /https:\/\/[^/]+\.(supabase|co|digitaloceanspaces|com)/g;
const CLEAN_LABEL = "[DATABASE]";

/**
 * Filter and sanitize error messages before logging to the console.
 * Specifically avoids "loud" logging during known offline states.
 */
export function logSafeError(error: any, context?: string) {
  // If we are completely offline at the browser level, suppress the log entirely.
  // The useConnectivity hook already handles the UI feedback for this.
  if (typeof window !== "undefined" && !window.navigator.onLine) {
    return;
  }

  // If it's a "Failed to fetch" or similar network error, and we're online,
  // it might be a server-down scenario. Keep it brief.
  const message = (error?.message || String(error)).toLowerCase();
  const isNetworkIssue = 
    message.includes("failed to fetch") || 
    message.includes("network error") || 
    message.includes("pgrst301") ||
    message.includes("load failed");

  if (isNetworkIssue) {
    // Just a simple warning instead of a full stack trace for network/db issues
    console.warn(`[${context || "App"}] Koneksi database terganggu. ${CLEAN_LABEL}`);
    return;
  }

  // Sanitize potentially sensitive data (like full URLs in the message)
  let sanitizedMessage = (error?.message || String(error)).replace(DB_URL_REGEX, CLEAN_LABEL);
  
  if (context) {
    console.error(`[${context}]`, sanitizedMessage);
  } else {
    console.error(sanitizedMessage);
  }
}

/**
 * For secondary warnings that don't need to be loud during DC.
 */
export function logSafeWarn(message: string, error?: any) {
  if (typeof window !== "undefined" && !window.navigator.onLine) return;
  
  const sanitized = message.replace(DB_URL_REGEX, CLEAN_LABEL);
  if (error) {
    console.warn(sanitized, (error?.message || String(error)).replace(DB_URL_REGEX, CLEAN_LABEL));
  } else {
    console.warn(sanitized);
  }
}
