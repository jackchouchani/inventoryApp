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

    // Vérifier si nous avons un ID valide
    const recordId = data.result?.id || (data.arguments?.[0] as number);
    
    if (!recordId) {
      console.warn(`Impossible de créer un log d'audit pour l'action ${action}: ID manquant`);
      return; // Ne pas créer de log si nous n'avons pas d'ID
    }

    const { error } = await supabase
      .from('audit_logs')
      .insert({
        table_name: 'items',
        operation: action,
        record_id: recordId,
        changes: {
          old_data: data.arguments[1], // Pour les updates, le deuxième argument est souvent les anciennes données
          new_data: data.result
        },
        user_id: user.data.user.id,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Erreur lors de la création du log d'audit:`, error);
      // Ne pas faire échouer l'opération principale à cause d'une erreur de log
    }
  }
};
