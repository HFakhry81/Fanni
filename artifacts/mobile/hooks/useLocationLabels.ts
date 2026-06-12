import { useState, useEffect, useRef } from "react";

interface LocationEntry {
  id: string;
  nameEn: string;
  nameAr: string;
  type: string;
  parentId: string | null;
}

let cachedLocations: LocationEntry[] | null = null;
let cachePromise: Promise<LocationEntry[]> | null = null;

function fetchAllLocations(): Promise<LocationEntry[]> {
  if (cachedLocations) return Promise.resolve(cachedLocations);
  if (cachePromise) return cachePromise;

  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  const base = domain ? `http://${domain}` : "";

  cachePromise = fetch(`${base}/api/locations/all`)
    .then((r) => (r.ok ? r.json() : { locations: [] }))
    .then((data: { locations?: LocationEntry[] }) => {
      cachedLocations = data.locations ?? [];
      cachePromise = null;
      return cachedLocations;
    })
    .catch(() => {
      cachePromise = null;
      cachedLocations = [];
      return [];
    });

  return cachePromise;
}

export function useLocationLabels() {
  const [locations, setLocations] = useState<LocationEntry[]>(cachedLocations ?? []);
  const [loading, setLoading] = useState<boolean>(cachedLocations === null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (cachedLocations === null) {
      fetchAllLocations().then((locs) => {
        if (mountedRef.current) {
          setLocations(locs);
          setLoading(false);
        }
      });
    }
    return () => { mountedRef.current = false; };
  }, []);

  function slugToName(slug: string | undefined | null, lang: "en" | "ar" = "en"): string {
    if (!slug) return "";
    if (loading) return "";
    const entry = locations.find((l) => l.id === slug);
    if (!entry) return slug;
    return lang === "ar" ? (entry.nameAr || entry.nameEn) : (entry.nameEn || entry.nameAr);
  }

  return { slugToName, locations, loading };
}
