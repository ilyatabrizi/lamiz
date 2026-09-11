// Add to home screen. Chrome and Edge hand us an event to fire; iOS Safari has no
// such API, so there we explain the two taps instead.

let deferred = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });

export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isAndroid = () => /android/i.test(navigator.userAgent);

export const canPrompt = () => !!deferred;

export async function promptInstall() {
  if (!deferred) return "unavailable";
  deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  return outcome;
}
