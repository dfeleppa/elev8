import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';

const NetworkDiagnostic: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const testNetworkRequests = async () => {
    setLoading(true);
    setLogs([]);

    try {
      log('🌐 Starting network diagnostic tests...');

      // Intercept and log fetch requests
      const originalFetch = window.fetch;
      const requests: any[] = [];

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        const method = init?.method || 'GET';
        const headers = init?.headers || {};
        
        log(`📡 REQUEST: ${method} ${url}`);
        log(`   Headers: ${JSON.stringify(headers, null, 2)}`);
        
        requests.push({ url, method, headers });
        
        try {
          const response = await originalFetch(input, init);
          
          log(`📥 RESPONSE: ${response.status} ${response.statusText}`);
          if (!response.ok) {
            const errorText = await response.clone().text();
            log(`   Error body: ${errorText}`);
          }
          
          return response;
        } catch (fetchError) {
          log(`💥 FETCH ERROR: ${fetchError}`);
          throw fetchError;
        }
      };

      // Test 1: Simple members query
      log('1️⃣ Testing simple members query...');
      try {
        const { data, error } = await supabase
          .from('members')
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          log(`❌ Members query failed: ${JSON.stringify(error)}`);
        } else {
          log(`✅ Members query succeeded`);
        }
      } catch (err) {
        log(`💥 Members query exception: ${err}`);
      }

      // Test 2: Auth signup attempt
      log('2️⃣ Testing auth signup...');
      const testEmail = `diagnostic-${Date.now()}@test.com`;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: testEmail,
          password: 'TestPassword123!',
          options: {
            data: {
              first_name: 'Test',
              last_name: 'User',
            }
          }
        });
        
        if (error) {
          log(`❌ Auth signup failed: ${JSON.stringify(error)}`);
        } else {
          log(`✅ Auth signup succeeded. User ID: ${data.user?.id}`);
          
          // Test 3: Member insert if auth succeeded
          if (data.user?.id) {
            log('3️⃣ Testing member record insert...');
            try {
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
                log(`❌ Member insert failed: ${JSON.stringify(memberError)}`);
              } else {
                log(`✅ Member insert succeeded: ${JSON.stringify(memberData)}`);
                
                // Cleanup
                await supabase.from('members').delete().eq('id', data.user.id);
                log('🧹 Cleanup completed');
              }
            } catch (memberErr) {
              log(`💥 Member insert exception: ${memberErr}`);
            }
          }
        }
      } catch (authErr) {
        log(`💥 Auth signup exception: ${authErr}`);
      }

      // Restore original fetch
      window.fetch = originalFetch;

      log('📊 Network diagnostic completed');
      log(`📝 Total requests captured: ${requests.length}`);
      requests.forEach((req, index) => {
        log(`   ${index + 1}. ${req.method} ${req.url}`);
      });

    } catch (error) {
      log(`💥 Diagnostic exception: ${error}`);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Network Diagnostic</h1>
        
        <div className="mb-6 space-x-4">
          <button
            onClick={testNetworkRequests}
            disabled={loading}
            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Running Diagnostic...' : 'Run Network Diagnostic'}
          </button>
          <button
            onClick={clearLogs}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Clear Logs
          </button>
        </div>

        <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-auto">
          {logs.length === 0 ? (
            <div className="text-gray-500">Click "Run Network Diagnostic" to start...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-2">Network Diagnostic Information</h3>
          <p className="text-sm text-purple-700">
            This test intercepts all network requests to see exactly what's being sent to Supabase.
            It will show headers, request details, and response information to help identify
            the "No API key found" issue.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NetworkDiagnostic;
