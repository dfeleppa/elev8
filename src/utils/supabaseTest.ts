// Test file to debug Supabase configuration
import { supabase } from './supabase';

export const testSupabaseConnection = async () => {
  console.log('=== Supabase Connection Test ===');
  
  // Check environment variables
  console.log('Environment variables:');
  console.log('- VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('- VITE_SUPABASE_ANON_KEY exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
  console.log('- VITE_SUPABASE_ANON_KEY length:', import.meta.env.VITE_SUPABASE_ANON_KEY?.length);
  
  // Test basic connection
  try {
    console.log('Testing Supabase client...');
    const { data, error } = await supabase.from('members').select('count').limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('Supabase connection successful!', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
  
  console.log('=== End Supabase Test ===');
};

// Auto-run test in development
if (import.meta.env.DEV) {
  setTimeout(() => {
    testSupabaseConnection();
  }, 1000);
}
