import { supabase } from './supabase';

export const checkSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('Supabase connection test:', { data, error });
    return { success: !error, data, error };
  } catch (err) {
    console.error('Supabase connection failed:', err);
    return { success: false, error: err };
  }
};

export const testSupabaseAuth = async () => {
  try {
    // Test if we can reach Supabase auth
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user);
    return { success: true, user };
  } catch (err) {
    console.error('Auth test failed:', err);
    return { success: false, error: err };
  }
};

// Helper to validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper to validate password strength
export const validatePassword = (password: string) => {
  const minLength = 6;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  
  const validations = {
    minLength: password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    isValid: password.length >= minLength
  };
  
  return validations;
};

// Helper to get user role from metadata
export const getUserRole = (user: any) => {
  return user?.user_metadata?.role || user?.app_metadata?.role || 'member';
};
