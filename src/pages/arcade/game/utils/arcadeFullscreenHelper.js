/**
 * arcadeFullscreenHelper.js
 * Cross-browser, touch-safe Fullscreen API controller for Retro Arcade Games.
 * Supports Native Browser Fullscreen + Fallback CSS Fullscreen + Screen Orientation.
 */

export function isBrowserFullscreen() {
  if (typeof document === 'undefined') return false;
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

export async function enterBrowserFullscreen(element = document.documentElement) {
  if (typeof document === 'undefined' || !element) return false;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else if (element.mozRequestFullScreen) {
      await element.mozRequestFullScreen();
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }
    return true;
  } catch (err) {
    console.warn('Native Fullscreen request was blocked or not allowed:', err);
    return false;
  }
}

export async function exitBrowserFullscreen() {
  if (typeof document === 'undefined') return false;
  try {
    if (!isBrowserFullscreen()) return true;
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      await document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      await document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      await document.msExitFullscreen();
    }
    return true;
  } catch (err) {
    console.warn('Exit Fullscreen error:', err);
    return false;
  }
}

export async function toggleBrowserFullscreen(element = document.documentElement) {
  if (isBrowserFullscreen()) {
    await exitBrowserFullscreen();
    return false;
  } else {
    const success = await enterBrowserFullscreen(element);
    return success;
  }
}

export function onFullscreenChange(callback) {
  if (typeof document === 'undefined') return () => {};
  
  const handler = () => {
    callback(isBrowserFullscreen());
  };

  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);

  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}
