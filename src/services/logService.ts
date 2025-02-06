import { supabase } from '../config/supabase';

export interface AuditLog {
  user_id: string;
  action: string;
  metadata?: any;
}

export const logService = {
  async logAction(action: string, metadata?: any) {
    const user = await supabase.auth.getUser();
    if (!user.data.user) {
      throw new Error('Utilisateur non authentifié');
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        user_id: user.data.user.id,
        action,
        metadata,
        created_at: new Date().toISOString()
      }]);

    if (error) throw error;
  }
};
