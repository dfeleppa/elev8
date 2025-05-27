import React, { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase';
import QuickSupabaseTest from '../../components/debug/QuickSupabaseTest';

const SupabaseDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Check environment variables
    const envInfo = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      hasAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
      anonKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length,
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE
    };
    
    setDebugInfo(envInfo);
    
    // Test connection
    testSupabaseConnection();
  }, []);

  const testSupabaseConnection = async () => {
    try {
      setTestResult('Testing connection...');
      
      // Test 1: Basic query
      const { data, error } = await supabase
        .from('members')
        .select('count')
        .limit(1);
      
      if (error) {
        setTestResult(`❌ Error: ${error.message}\nDetails: ${JSON.stringify(error, null, 2)}`);
      } else {
        setTestResult(`✅ Connection successful!\nData: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err: any) {
      setTestResult(`❌ Unexpected error: ${err.message}\nStack: ${err.stack}`);
    }
  };
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Supabase Debug</h1>
      
      <QuickSupabaseTest />
      
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Environment Variables</h2>
        <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Connection Test</h2>
        <button
          onClick={testSupabaseConnection}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Test Connection
        </button>
        <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">
          {testResult}
        </pre>
      </div>
    </div>
  );
};

export default SupabaseDebug;
