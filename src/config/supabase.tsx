import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@env';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Les variables d\'environnement Supabase ne sont pas définies');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
