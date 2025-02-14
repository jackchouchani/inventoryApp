import { supabase } from '../config/supabase';

export interface AuditLog {
  id?: number;
  user_id: string;
  action: string;
  metadata: {
    table?: string;
    schema?: string;
    operation: string;
    record_id?: number;
    old_data?: any;
    new_data?: any;
    arguments?: any[];
  };
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
        user_id: user.data.user.id,
        action,
        metadata: {
          operation: action,
          record_id: data.result?.id,
          old_data: data.arguments[1], // Pour les updates, le deuxième argument est souvent les anciennes données
          new_data: data.result,
          arguments: data.arguments
        },
        created_at: new Date().toISOString()
      });

    if (error) throw error;
  }
};
