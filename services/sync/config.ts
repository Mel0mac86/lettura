/**
 * Cloud configuration (V2). Values come from `EXPO_PUBLIC_*` environment
 * variables (see .env.example). Only the public anon key may be used in the
 * app: never put service-role keys in the client.
 */
export interface CloudConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export function getCloudConfig(): CloudConfig | null {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}

export function isCloudConfigured(): boolean {
  return getCloudConfig() !== null;
}
