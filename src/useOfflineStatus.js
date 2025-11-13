import { useEffect, useState } from "react";

export function useOfflineStatus(interval = 8000) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateFromBrowser = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateFromBrowser);
    window.addEventListener("offline", updateFromBrowser);

    const checkOnlineStatus = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        // Works in Chrome, Safari, mobile WebViews
        await fetch("https://www.google.com/generate_204", {
          method: "HEAD",
          mode: "no-cors",
          signal: controller.signal,
        });

        clearTimeout(timeout);
        setIsOnline(true);
      } catch {
        setIsOnline(false);
      }
    };

    checkOnlineStatus();
    const id = setInterval(checkOnlineStatus, interval);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", updateFromBrowser);
      window.removeEventListener("offline", updateFromBrowser);
    };
  }, [interval]);

  return isOnline;
}
