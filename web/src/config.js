// Public values only. The publishable key is safe in the browser; the demo_requests table
// has no anon access, so this key can't read or write it directly.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fvvxmvtoozpxmdkdumrx.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_xW8-cNceQT7G9xrmIbQlZA_FXMIZt4c';
export const DEMO_ENDPOINT = `${SUPABASE_URL}/functions/v1/request-demo`;

// OpenFreeMap: free vector basemap, no API key, OpenStreetMap data.
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
