import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

const MinimalApiTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Automatically run basic test on component mount
    testBasicConnection();
  }, []);

  const testBasicConnection = async () => {
    setLoading(true);
    setResult('🔄 Testing basic connection...\n');

    try {
      // Test 1: Environment check
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      setResult(prev => prev + `✅ Environment variables loaded\n`);
      setResult(prev => prev + `   URL: ${url}\n`);
      setResult(prev => prev + `   Key exists: ${!!key} (length: ${key?.length})\n\n`);

      // Test 2: Simple query
      setResult(prev => prev + `🔄 Testing simple query...\n`);
      const { data, error, count } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });

      if (error) {
        setResult(prev => prev + `❌ Query failed: ${error.message}\n`);
        setResult(prev => prev + `   Code: ${error.code}\n`);
        setResult(prev => prev + `   Details: ${error.details}\n`);
        setResult(prev => prev + `   Hint: ${error.hint}\n\n`);
      } else {
        setResult(prev => prev + `✅ Query succeeded\n`);
        setResult(prev => prev + `   Count: ${count}\n\n`);
      }

      // Test 3: Check if the issue is auth-related
      setResult(prev => prev + `🔄 Testing auth status...\n`);
      const { data: session, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        setResult(prev => prev + `❌ Auth error: ${authError.message}\n\n`);
      } else {
        setResult(prev => prev + `✅ Auth check complete\n`);
        setResult(prev => prev + `   Authenticated: ${!!session.session}\n\n`);
      }

    } catch (err: any) {
      setResult(prev => prev + `💥 Exception: ${err.message}\n`);
      setResult(prev => prev + `   Stack: ${err.stack}\n\n`);
    } finally {
      setLoading(false);
    }
  };

  const testRegistrationStep = async () => {
    setLoading(true);
    setResult(prev => prev + `\n🚀 Testing registration step...\n`);

    try {
      const testEmail = `minimal-test-${Date.now()}@test.com`;
      
      setResult(prev => prev + `🔄 Attempting auth signup...\n`);
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!'
      });

      if (error) {
        setResult(prev => prev + `❌ Auth signup failed: ${error.message}\n`);
        setResult(prev => prev + `   Code: ${error.code}\n\n`);
      } else {
        setResult(prev => prev + `✅ Auth signup succeeded\n`);
        setResult(prev => prev + `   User ID: ${data.user?.id}\n\n`);

        // Test member insert
        if (data.user?.id) {
          setResult(prev => prev + `🔄 Testing member insert...\n`);
          const { data: memberData, error: memberError } = await supabase
            .from('members')
            .insert({
              id: data.user.id,
              firstname: 'Test',
              lastname: 'User',
              email: testEmail,
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

          if (memberError) {
            setResult(prev => prev + `❌ Member insert failed: ${memberError.message}\n`);
            setResult(prev => prev + `   Code: ${memberError.code}\n`);
            setResult(prev => prev + `   Details: ${memberError.details}\n\n`);
          } else {
            setResult(prev => prev + `✅ Member insert succeeded\n\n`);
            
            // Cleanup
            await supabase.from('members').delete().eq('id', data.user.id);
            setResult(prev => prev + `🧹 Cleanup completed\n`);
          }
        }
      }

    } catch (err: any) {
      setResult(prev => prev + `💥 Registration test exception: ${err.message}\n\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Minimal API Test</h1>
        
        <div className="mb-6 space-x-4">
          <button
            onClick={testBasicConnection}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Basic Connection'}
          </button>
          <button
            onClick={testRegistrationStep}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Registration Step'}
          </button>
          <button
            onClick={() => setResult('')}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Clear
          </button>
        </div>

        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm min-h-96 whitespace-pre-wrap">
          {result || 'Click "Test Basic Connection" to start...'}
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Simple API Test</h3>
          <p className="text-sm text-blue-700">
            This is a minimal test to identify exactly where the "No API key found" error occurs.
            It runs automatically on page load and provides step-by-step debugging.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MinimalApiTest;
