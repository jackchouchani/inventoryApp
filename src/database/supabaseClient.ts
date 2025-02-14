import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be defined in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey); 