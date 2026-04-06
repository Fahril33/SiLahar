export function notifyBackgroundTask(title: string, body: string) {
  if (typeof window === "undefined") {
    return;
  }

  if (
    document.visibilityState === "hidden" &&
    "Notification" in window &&
    Notification.permission === "granted"
  ) {
    try {
      new Notification(title, { body });
    } catch {
      // Fallback sengaja diam; toast in-app tetap dipakai oleh caller.
    }
  }
}
