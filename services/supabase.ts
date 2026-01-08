
import { createClient } from '@supabase/supabase-js';

// These should be your actual project details from the Supabase dashboard
const supabaseUrl = 'https://brrgoanuhpiqxqvqgfnp.supabase.co';
// The public anon key is safe to include in client-side code
const supabaseAnonKey = 'sb_publishable_N3W_61uZa920EiehknsfTw_Fzw5aWCC'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
