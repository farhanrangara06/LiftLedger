import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://sbxsgunpmcjpkwhbzazn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNieHNndW5wbWNqcGt3aGJ6YXpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQyMDI5MjMsImV4cCI6MjEwOTc3ODkyM30._YOnZjY04o-tlOwGg7pyU5O5RC_KtCxG4VwpYSm9MdI';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
