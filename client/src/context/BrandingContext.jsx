import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { brandingApi } from '../api/client';

const BrandingContext = createContext(null);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(null);
  const [error, setError] = useState(null);
  const [logoUrl, setLogoUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    brandingApi
      .get()
      .then((response) => {
        if (!cancelled) setBranding(response.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLogo = Boolean(branding?.hasLogo);
  const logoVersion = branding?.logoVersion ?? null;

  useEffect(() => {
    if (!hasLogo) {
      setLogoUrl(null);
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl = null;
    brandingApi
      .fetchLogo(logoVersion, { signal: controller.signal })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setLogoUrl(objectUrl);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLogoUrl(null);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasLogo, logoVersion]);

  const saveTitle = useCallback(async (title) => {
    const response = await brandingApi.updateTitle(title);
    setBranding(response.data);
  }, []);

  const uploadLogo = useCallback(async (file) => {
    const response = await brandingApi.uploadLogo(file);
    setBranding(response.data);
  }, []);

  const removeLogo = useCallback(async () => {
    const response = await brandingApi.removeLogo();
    setBranding(response.data);
  }, []);

  const value = useMemo(
    () => ({ branding, error, logoUrl, saveTitle, uploadLogo, removeLogo }),
    [branding, error, logoUrl, saveTitle, uploadLogo, removeLogo]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used within <BrandingProvider>');
  return context;
}
