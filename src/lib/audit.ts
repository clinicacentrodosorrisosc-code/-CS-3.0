import { supabase } from '../supabaseClient';

export type AuditAction = 'LOGIN' | 'LOGOUT' | 'VIEW';

export const recordAuditEvent = async (
  action: AuditAction,
  module: string,
  description: string,
  metadata: Record<string, unknown> = {},
) => {
  try {
    const { error } = await supabase.rpc('record_audit_event', {
      p_action: action,
      p_module: module,
      p_description: description,
      p_metadata: metadata,
    });

    if (error) console.warn('Nao foi possivel registrar o evento de auditoria:', error.message);
  } catch (error) {
    console.warn('Falha ao registrar evento de auditoria:', error);
  }
};
