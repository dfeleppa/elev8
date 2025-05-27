import React, { useState } from 'react';
import { checkSupabaseConnection, testSupabaseAuth } from '../../utils/authHelpers';

const AuthTest: React.FC = () => {
  const [testResults, setTestResults] = useState<any>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  const runConnectionTest = async () => {
    setIsTestingConnection(true);
    try {
      const connectionResult = await checkSupabaseConnection();
      const authResult = await testSupabaseAuth();
      
      setTestResults({
        connection: connectionResult,
        auth: authResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      setTestResults({
        error: error,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-4">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        🔧 Development Tools
      </h3>
      <button
        onClick={runConnectionTest}
        disabled={isTestingConnection}
        className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isTestingConnection ? 'Testing...' : 'Test Supabase Connection'}
      </button>
      
      {testResults && (
        <div className="mt-3 text-xs">
          <details className="bg-white dark:bg-gray-700 p-2 rounded">
            <summary className="cursor-pointer text-gray-600 dark:text-gray-400">
              Test Results ({testResults.timestamp})
            </summary>
            <pre className="mt-2 text-gray-800 dark:text-gray-200 overflow-auto">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default AuthTest;
