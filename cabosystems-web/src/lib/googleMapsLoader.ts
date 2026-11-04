let googleMapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(language: 'es' | 'en' = 'es'): Promise<typeof google> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not configured.'));

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = '__csyGoogleMapsReady';
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-csy-google-maps]');
    const timeout = window.setTimeout(() => reject(new Error('Google Maps took too long to load.')), 20_000);

    const finish = () => {
      window.clearTimeout(timeout);
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps could not be initialized.'));
    };

    Object.assign(window, { [callbackName]: finish });
    if (existingScript) {
      existingScript.addEventListener('load', finish, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Maps could not be loaded.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.dataset.csyGoogleMaps = 'true';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&libraries=marker&language=${language}&region=MX&callback=${callbackName}`;
    script.onerror = () => {
      window.clearTimeout(timeout);
      googleMapsPromise = null;
      reject(new Error('Google Maps could not be loaded.'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
