import { createClient } from '@supabase/supabase-js';

// Auxiliar para obter variáveis de ambiente com segurança
const getEnvVar = (name: string): string | undefined => {
  try {
    return (import.meta as any).env[name] || (process as any).env[name];
  } catch (e) {
    return undefined;
  }
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined' &&
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-key')
);

// Apenas chama createClient se tivermos configuração válida
const realSupabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Utilitários para conversão de nomes de colunas (camelCase <-> snake_case) recursivos
export const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const n: any = {};
    for (const key in obj) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      n[snakeKey] = toSnakeCase(obj[key]);
    }
    return n;
  }
  return obj;
};

export const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const n: any = {};
    for (const key in obj) {
      const camelKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
      n[camelKey] = toCamelCase(obj[key]);
    }
    return n;
  }
  return obj;
};

// Proxy para evitar erros quando o supabase não está configurado
export const supabase = new Proxy({} as any, {
  get: (target, prop) => {
    if (!isSupabaseConfigured) {
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
