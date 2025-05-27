// Test basic Supabase functionality
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

const QuickSupabaseTest: React.FC = () => {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const runTest = async () => {
    setLoading(true);
    setResult('Starting test...\n');
    
    try {
      // Test 1: Check if client is initialized
      setResult(prev => prev + 'Client initialized: ✓\n');
      
      // Test 2: Try to access a public endpoint
      setResult(prev => prev + 'Testing public endpoint...\n');
      const { data: healthData, error: healthError } = await supabase.rpc('version');
      
      if (healthError) {
        setResult(prev => prev + `Health check error: ${healthError.message}\n`);
      } else {
        setResult(prev => prev + `Health check: ✓\n`);
      }
      
      // Test 3: Try to access members table
      setResult(prev => prev + 'Testing members table access...\n');
      const { data, error } = await supabase
        .from('members')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        setResult(prev => prev + `Members table error:\n${JSON.stringify(error, null, 2)}\n`);
      } else {
        setResult(prev => prev + `Members table access: ✓ (${data?.length || 0} rows)\n`);
      }
      
      // Test 4: Try to get session
      setResult(prev => prev + 'Testing auth session...\n');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        setResult(prev => prev + `Session error: ${sessionError.message}\n`);
      } else {
        setResult(prev => prev + `Session check: ✓ (User: ${sessionData.session?.user?.email || 'anonymous'})\n`);
      }
      
    } catch (err: any) {
      setResult(prev => prev + `Unexpected error: ${err.message}\n`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-4">Quick Supabase Test</h2>
      <button 
        onClick={runTest} 
        disabled={loading}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
      >
        {loading ? 'Testing...' : 'Run Test'}
      </button>
      <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm whitespace-pre-wrap">
        {result}
      </pre>
    </div>
  );
};

export default QuickSupabaseTest;
