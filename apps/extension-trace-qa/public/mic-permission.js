/**
 * Microphone Permission Page Script
 *
 * Runs in a small popup window opened by the background service worker.
 * Calls getUserMedia to trigger the browser's mic permission prompt,
 * then reports the result back via chrome.runtime.sendMessage and auto-closes.
 *
 * This page runs under the chrome-extension:// origin, so permission
 * grants here apply to the offscreen document (same origin).
 */
(async function requestMicPermission() {
  const statusEl = document.getElementById('status');
  const spinnerEl = document.getElementById('spinner');
  const errorEl = document.getElementById('error');

  const ts = () => new Date().toLocaleTimeString('en-GB', {
    hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  console.log(`[MIC-PERM][PERMISSION-PAGE] Page loaded at ${ts()}`);
  console.log('[MIC-PERM][PERMISSION-PAGE] Origin:', window.location.origin);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Permission granted — stop tracks immediately (we only needed the prompt)
    stream.getTracks().forEach(function(track) { track.stop(); });

    console.log(`[MIC-PERM][PERMISSION-PAGE] getUserMedia SUCCEEDED at ${ts()}`);

    // Persist result
    await chrome.storage.local.set({ micPermissionGranted: true });

    // Notify background
    await chrome.runtime.sendMessage({
      type: 'MIC_PERMISSION_RESULT',
      payload: { granted: true },
    });

    // Show success briefly
    spinnerEl.style.display = 'none';
    statusEl.textContent = 'Microphone access granted!';
    statusEl.classList.add('success');

    // Auto-close after a short delay so user sees the success message
    setTimeout(function() { window.close(); }, 600);

  } catch (err) {
    const errName = err instanceof DOMException ? err.name : 'Unknown';
    const errMsg = err instanceof Error ? err.message : String(err);

    console.error(`[MIC-PERM][PERMISSION-PAGE] getUserMedia FAILED at ${ts()}`);
    console.error(`[MIC-PERM][PERMISSION-PAGE] error.name: ${errName}`);
    console.error(`[MIC-PERM][PERMISSION-PAGE] error.message: ${errMsg}`);

    // Persist result
    await chrome.storage.local.set({ micPermissionGranted: false });

    // Notify background
    await chrome.runtime.sendMessage({
      type: 'MIC_PERMISSION_RESULT',
      payload: { granted: false, error: errMsg },
    });

    // Show error briefly
    spinnerEl.style.display = 'none';
    statusEl.textContent = 'Microphone access denied';
    statusEl.style.color = '#dc2626';
    errorEl.textContent = errMsg;
    errorEl.style.display = 'block';

    // Auto-close after showing error
    setTimeout(function() { window.close(); }, 1500);
  }
})();
