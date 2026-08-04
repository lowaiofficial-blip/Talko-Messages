// Browser fingerprint generator for security and bot management

export const getBrowserFingerprint = (): string => {
  try {
    const nav = window.navigator;
    const screen = window.screen;
    
    // Canvas fingerprinting signature
    let canvasHash = '';
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('TalkoSecurityFingerprint,123', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('TalkoSecurityFingerprint,123', 4, 17);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        canvasHash = hash.toString(36);
      }
    } catch {
      canvasHash = 'nocanvas';
    }

    const rawId = [
      nav.userAgent,
      nav.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvasHash
    ].join('||');

    let hash = 0;
    for (let i = 0; i < rawId.length; i++) {
      const char = rawId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }

    // Combine with persistent local storage device key
    let localDeviceKey = localStorage.getItem('talko_device_fingerprint');
    if (!localDeviceKey) {
      localDeviceKey = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('talko_device_fingerprint', localDeviceKey);
    }

    return `FP_${Math.abs(hash).toString(36)}_${localDeviceKey}`;
  } catch {
    let localDeviceKey = localStorage.getItem('talko_device_fingerprint');
    if (!localDeviceKey) {
      localDeviceKey = 'dev_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('talko_device_fingerprint', localDeviceKey);
    }
    return `FP_FALLBACK_${localDeviceKey}`;
  }
};
