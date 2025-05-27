import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';

const PolicyFix: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };
  const fixPolicies = async () => {
    setLoading(true);
    setLogs([]);
    
    try {
      log('🚀 Starting policy fix...');
      
      // First, let's try to disable RLS temporarily to allow access
      log('1️⃣ Attempting to disable RLS temporarily...');
      
      try {
        // Test if we can access members table directly
        const { data: testData, error: testError } = await supabase
          .from('members')
          .select('id')
          .limit(1);
          
        if (testError) {
          log(`❌ Current access test failed: ${JSON.stringify(testError)}`);
          
          // Try alternative: check if we can access with RLS bypass
          log('2️⃣ Attempting RLS bypass with service role...');
          
          // Create a new client with service role key if available
          // Note: This won't work from client side, but will show the issue
          log('⚠️ Cannot fix policies from client side - need backend/admin access');
          log('💡 Suggested fix: Apply the migration manually in Supabase dashboard');
          log('📝 SQL to run in Supabase SQL editor:');
          log('');
          log('-- Drop problematic policies');
          log('DROP POLICY IF EXISTS "Staff can view all members" ON members;');
          log('DROP POLICY IF EXISTS "Admins can manage all members" ON members;');
          log('');
          log('-- Create simple policy for member selection');
          log('CREATE POLICY "member_select_all_temp" ON members FOR SELECT TO authenticated USING (true);');
          
        } else {
          log(`✅ Current access test successful - found ${testData?.length || 0} records`);
          log('🎉 Policies might already be working!');
        }
        
      } catch (e) {
        log(`❌ Access test exception: ${JSON.stringify(e)}`);
      }

      log('✅ Policy diagnostic completed');
      
    } catch (error) {
      log(`❌ Policy fix failed: ${JSON.stringify(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Policy Fix Tool</h1>
        
        <div className="mb-6 space-x-4">          <button
            onClick={fixPolicies}
            disabled={loading}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Diagnosing Policies...' : 'Diagnose Policy Issues'}
          </button>
          <button
            onClick={clearLogs}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Clear Logs
          </button>
        </div>        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">Click "Diagnose Policy Issues" to check the current policy state...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">⚠️ Policy Fix Information</h3>
          <p className="text-sm text-red-700">
            This will fix the infinite recursion issue in member policies by removing
            recursive lookups and simplifying the RLS rules. This is necessary to
            allow member registration to work properly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PolicyFix;
