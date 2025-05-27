import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

const ApiKeyTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (test: string, result: any, error?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [...prev, {
      timestamp,
      test,
      result,
      error,
      success: !error
    }]);
  };

  const runTests = async () => {
    setLoading(true);
    setTestResults([]);

    // Test 1: Environment variables
    addResult('Environment Variables', {
      url: import.meta.env.VITE_SUPABASE_URL,
      keyExists: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      keyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length
    });

    // Test 2: Direct Supabase client test
    try {
      const { data, error } = await supabase
        .from('members')
        .select('count', { count: 'exact', head: true });
      
      addResult('Direct Members Query', data, error);
    } catch (err) {
      addResult('Direct Members Query', null, err);
    }

    // Test 3: Auth status
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      addResult('Auth Session', { 
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email 
      }, error);
    } catch (err) {
      addResult('Auth Session', null, err);
    }

    // Test 4: Raw fetch test with API key
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/members?select=count`, {
        method: 'GET',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      });
      
      const responseData = await response.text();
      addResult('Raw Fetch Test', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData
      }, response.ok ? null : `HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      addResult('Raw Fetch Test', null, err);
    }

    // Test 5: Test with different client options
    try {
      const testClient = import('@supabase/supabase-js').then(({ createClient }) => 
        createClient(
          import.meta.env.VITE_SUPABASE_URL!,
          import.meta.env.VITE_SUPABASE_ANON_KEY!,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
            }
          }
        )
      );
      
      const client = await testClient;
      const { data, error } = await client
        .from('members')
        .select('count', { count: 'exact', head: true });
      
      addResult('Test Client Query', data, error);
    } catch (err) {
      addResult('Test Client Query', null, err);
    }

    setLoading(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">API Key Debugging Test</h1>
        
        <div className="mb-6">
          <button
            onClick={runTests}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running Tests...' : 'Run Tests Again'}
          </button>
        </div>

        <div className="space-y-4">
          {testResults.map((result, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{result.test}</h3>
                <span className="text-sm text-gray-500">{result.timestamp}</span>
              </div>
              
              {result.success ? (
                <div className="text-green-800">
                  <p className="text-sm font-medium mb-1">✅ Success</p>
                  <pre className="text-xs bg-green-100 p-2 rounded overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="text-red-800">
                  <p className="text-sm font-medium mb-1">❌ Error</p>
                  <pre className="text-xs bg-red-100 p-2 rounded overflow-auto">
                    {JSON.stringify(result.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {testResults.length === 0 && !loading && (
          <div className="text-center text-gray-500 py-8">
            Click "Run Tests" to start debugging
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiKeyTest;
