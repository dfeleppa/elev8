import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging for development
if (import.meta.env.DEV) {
  console.log('🔧 Supabase Configuration:');
  console.log('- URL:', supabaseUrl);
  console.log('- Anon Key exists:', !!supabaseAnonKey);
  console.log('- Anon Key length:', supabaseAnonKey?.length);
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:', {
    url: supabaseUrl,
    keyExists: !!supabaseAnonKey,
    allEnvVars: import.meta.env
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Create Supabase client with options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'apikey': supabaseAnonKey,
    }
  }
});

// Test connection on initialization in development
if (import.meta.env.DEV) {
  console.log('🌐 Testing Supabase connection...');
  supabase.from('members').select('count', { count: 'exact', head: true })
    .then(({ error }) => {
      if (error) {
        console.error('❌ Supabase connection failed:', error);
      } else {
        console.log('✅ Supabase connection successful');
      }
    })
    .catch(err => {
      console.error('❌ Supabase connection error:', err);
    });
}