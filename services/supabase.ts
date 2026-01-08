
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://brrgoanuhpiqxqvqgfnp.supabase.co';
const supabaseAnonKey = 'sb_publishable_N3W_61uZa920EiehknsfTw_Fzw5aWCC';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
