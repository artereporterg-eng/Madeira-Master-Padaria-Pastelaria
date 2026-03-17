import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Esta verificação é o que define se o teu App.tsx mostra "Modo Offline" ou não
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl !== https://sfksrtviboxnukhvkkdv.supabase.co;

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');

// Funções auxiliares que o teu App.tsx está a tentar importar
export const toSnakeCase = (obj: any) => {
  const newObj: any = {};
  for (let key in obj) {
    newObj[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = obj[key];
  }
  return newObj;
};

export const toCamelCase = (obj: any) => {
  const newObj: any = {};
  for (let key in obj) {
    newObj[key.replace(/(_\w)/g, m => m[1].toUpperCase())] = obj[key];
  }
  return newObj;
};
