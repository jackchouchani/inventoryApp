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

    // Déterminer l'ID selon le type d'action
    let recordId: number | undefined;
    
    if (action.startsWith('ADD_')) {
      // Pour les actions d'ajout, result peut être soit l'ID (number) soit l'objet créé
      if (typeof data.result === 'number') {
        recordId = data.result;
      } else if (data.result?.id) {
        recordId = data.result.id;
      }
    } else if (action.startsWith('UPDATE_') || action.startsWith('DELETE_')) {
      // Pour les actions de mise à jour/suppression, l'ID est souvent le premier argument
      recordId = data.arguments?.[0] as number;
    } else {
      // Autres actions - essayer de trouver l'ID dans result ou arguments
      recordId = data.result?.id || (data.arguments?.[0] as number);
    }
    
    if (!recordId || typeof recordId !== 'number') {
      console.warn(`Impossible de créer un log d'audit pour l'action ${action}: ID manquant ou invalide`, { result: data.result, args: data.arguments });
      return;
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
