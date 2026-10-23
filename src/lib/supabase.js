import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vlsgrcpfdoxdqwdlkupb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_0Zil-0Jf4gGMrP6EWGLx2w_tD1yJLjd';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
