import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Loader, Key } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { isValidEmail, validatePassword } from '../../utils/authHelpers';
import { MemberService } from '../../utils/memberService';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gymCode, setGymCode] = useState('');
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validate input
      if (!firstName || !lastName || !email || !password || !gymCode) {
        throw new Error('Please fill in all fields');
      }

      // Validate gym code (case-insensitive)
      if (gymCode.toLowerCase() !== 'trainlyfe') {
        throw new Error('Invalid gym code. Please contact your gym administrator for the correct code.');
      }

      if (!isValidEmail(email)) {
        throw new Error('Please enter a valid email address');
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new Error('Password must be at least 6 characters long');
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: `${firstName.trim()} ${lastName.trim()}`,
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        try {
          console.log('Auth user created successfully:', data.user.id);
          
          // Test database connectivity first
          console.log('Testing database connectivity...');
          const { error: testError } = await supabase
            .from('members')
            .select('count', { count: 'exact', head: true });
          
          if (testError) {
            console.error('Database connectivity test failed:', testError);
          } else {
            console.log('Database connectivity test passed');
          }
          
          console.log('Creating member record with data:', {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            status: 'Active',
            memberships: [],
            tags: [],
            trackAccess: false,
          });

          // Create member record in database with the user's auth ID
          const memberResult = await MemberService.createMemberForUser(data.user.id, {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            status: 'Active',
            memberships: [],
            tags: [],
            trackAccess: false,
          });

          console.log('Member record created successfully:', memberResult);
        } catch (memberError: any) {
          console.error('Error creating member record:', memberError);
          console.error('Member error details:', {
            message: memberError.message,
            code: memberError.code,
            details: memberError.details,
            hint: memberError.hint,
            stack: memberError.stack,
          });
          
          // Also test direct insert to see if it's a service issue
          try {
            console.log('Testing direct database insert...');
            const { data: directData, error: directError } = await supabase
              .from('members')
              .insert({
                id: data.user.id,
                firstname: firstName.trim(),
                lastname: lastName.trim(),
                email: email.trim(),
                status: 'Active',
                memberships: [],
                tags: [],
                trackaccess: false,
                isstaff: false,
                isadmin: false,
                membersince: new Date().toISOString().split('T')[0],
                attendancecount: 0,
                lastactiveonapp: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (directError) {
              console.error('Direct insert also failed:', directError);
            } else {
              console.log('Direct insert succeeded:', directData);
            }
          } catch (directError) {
            console.error('Direct insert exception:', directError);
          }
          
          // Note: We don't throw here because the auth account was created successfully
          // The member record creation can be retried later if needed
        }

        // Check if email confirmation is required
        if (!data.session) {
          setError('Please check your email and click the confirmation link to complete registration.');
        } else {
          // Navigate to dashboard if immediately signed in
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      
      // Handle specific Supabase auth errors
      if (err.message?.includes('already registered')) {
        setError('This email is already registered. Please sign in or reset your password.');
      } else {
        setError(err.message || 'An error occurred during registration');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Or{' '}
          <Link
            to="/auth/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            sign in to your account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              {error.includes('already registered') && (
                <div className="mt-2 flex space-x-4 text-sm">
                  <Link
                    to="/auth/login"
                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/auth/reset-password"
                    className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Reset password
                  </Link>
                </div>
              )}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleRegister}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  First name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  </div>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="John"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Last name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Doe"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="gymCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Gym Code
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="gymCode"
                  name="gymCode"
                  type="text"
                  required
                  value={gymCode}
                  onChange={(e) => setGymCode(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Enter gym access code"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Contact your gym administrator if you don't have the access code
              </p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  'Create account'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                  By creating an account, you agree to our
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-center">
              <Link
                to="/privacy"
                className="text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;