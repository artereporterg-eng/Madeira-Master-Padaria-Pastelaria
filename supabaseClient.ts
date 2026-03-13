import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables safely in different environments
const getEnvVar = (name: string): string | undefined => {
  try {
    return (import.meta as any).env[name] || (process as any).env[name];
  } catch (e) {
    return undefined;
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'undefined' && supabaseAnonKey !== 'undefined');

if (!isSupabaseConfigured) {
  console.warn('Supabase is not configured. Data will not be persisted to the cloud. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Only call createClient if we have valid configuration to avoid "supabaseUrl is required" error
const realSupabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Proxy to prevent crashes when supabase is not configured
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    if (!isSupabaseConfigured) {
      // Return a dummy function/object that allows chaining to prevent crashes
      const dummyChain = () => dummyChain;
      dummyChain.select = () => Promise.resolve({ data: [], error: null });
      dummyChain.insert = () => Promise.resolve({ data: null, error: null });
      dummyChain.update = () => ({ eq: () => Promise.resolve({ data: null, error: null }) });
      dummyChain.delete = () => ({ eq: () => Promise.resolve({ data: null, error: null }) });
      dummyChain.upsert = () => Promise.resolve({ data: null, error: null });
      dummyChain.single = () => Promise.resolve({ data: null, error: null });
      dummyChain.eq = () => Promise.resolve({ data: null, error: null });
      
      if (prop === 'from') return () => dummyChain;
      return dummyChain;
    }
    return (realSupabase as any)[prop];
  }
});
