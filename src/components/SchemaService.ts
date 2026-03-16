// src/services/SchemaService.ts
import { supabase, isSupabaseConfigured } from '../supabaseClient';

export const SchemaService = {
  /**
   * Verifica e repara o esquema da base de dados no Supabase.
   * Chama a função RPC definida no banco de dados.
   */
  async repairSchema(): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase não configurado' };
    }

    try {
      console.log('Verificando integridade do banco de dados...');
      const { error } = await supabase.rpc('check_and_repair_schema');
      
      if (error) {
        console.error('Erro ao reparar esquema:', error);
        return { success: false, error: error.message };
      }

      console.log('Banco de dados sincronizado com sucesso.');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};
