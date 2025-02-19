import { supabase } from '../config/supabase';

export interface AuditLog {
  id?: number;
  table_name: string;
  operation: string;
  record_id: number;
  changes: {
    old_data?: any;
    new_data?: any;
  };
  user_id: string;
  created_at: string;
}

export const logService = {
  async logAction(action: string, data: { arguments: any[]; result: any }) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'items',
        operation: action,
        record_id: data.result?.id,
        changes: {
          old_data: data.arguments[1], // Pour les updates, le deuxième argument est souvent les anciennes données
          new_data: data.result
        },
        user_id: user.data.user.id,
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }
};
