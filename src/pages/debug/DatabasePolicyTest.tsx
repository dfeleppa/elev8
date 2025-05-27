import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';

const DatabasePolicyTest: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const testDatabasePolicies = async () => {
    setLoading(true);
    setLogs([]);

    try {
      log('🔍 Testing database policies and RLS...');

      // Test 1: Check current session
      log('1️⃣ Checking current auth session...');
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        log(`❌ Session error: ${JSON.stringify(sessionError)}`);
      } else {
        log(`✅ Session: ${session.session ? `Authenticated as ${session.session.user.email}` : 'Not authenticated'}`);
      }      // Test 2: Check members table by attempting to read it
      log('2️⃣ Testing members table access...');
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('id, firstname, lastname, email')
        .limit(5);
      
      if (membersError) {
        log(`❌ Members table access failed: ${JSON.stringify(membersError)}`);
      } else {
        log(`✅ Members table accessible. Found ${membersData?.length || 0} records`);
      }      // Test 3: Check database connection with different queries
      log('3️⃣ Testing various database operations...');
      
      // Simple count query
      const { count, error: countError } = await supabase
        .from('members')
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        log(`❌ Count query failed: ${JSON.stringify(countError)}`);
      } else {
        log(`✅ Members count query succeeded: ${count} total members`);
      }

      // Test 4: Test direct select without auth
      log('4️⃣ Testing direct select (should work for public read)...');
      const { data: selectData, error: selectError } = await supabase
        .from('members')
        .select('id, firstname, lastname')
        .limit(1);
      
      if (selectError) {
        log(`❌ Direct select failed: ${JSON.stringify(selectError)}`);
      } else {
        log(`✅ Direct select succeeded: ${JSON.stringify(selectData)}`);
      }

      // Test 5: Test insert without proper auth (should fail)
      log('5️⃣ Testing insert without proper auth (should fail)...');
      const testId = `test-${Date.now()}`;
      const { data: insertData, error: insertError } = await supabase
        .from('members')
        .insert({
          id: testId,
          firstname: 'Test',
          lastname: 'User',
          email: 'test@test.com',
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
      
      if (insertError) {
        log(`✅ Insert without auth properly failed: ${JSON.stringify(insertError)}`);
      } else {
        log(`❌ Insert without auth succeeded (this might be a problem): ${JSON.stringify(insertData)}`);
        // Clean up
        await supabase.from('members').delete().eq('id', testId);
      }      // Test 6: Test API key in headers
      log('6️⃣ Testing API key in request headers...');
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
        
        if (response.ok) {
          const headers = Object.fromEntries(response.headers.entries());
          log(`✅ Direct API call succeeded: ${response.status} ${response.statusText}`);
          log(`   Response headers: ${JSON.stringify(headers, null, 2)}`);
        } else {
          const errorText = await response.text();
          log(`❌ Direct API call failed: ${response.status} ${response.statusText}`);
          log(`   Error response: ${errorText}`);
        }
      } catch (fetchError) {
        log(`❌ Direct fetch error: ${JSON.stringify(fetchError)}`);
      }

    } catch (error) {
      log(`❌ Test exception: ${JSON.stringify(error)}`);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Policy Test</h1>
        
        <div className="mb-6 space-x-4">
          <button
            onClick={testDatabasePolicies}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running Test...' : 'Test Database Policies'}
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
            <div className="text-gray-500">Click "Test Database Policies" to start debugging...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Test Information</h3>
          <p className="text-sm text-blue-700">
            This test checks the database policies, RLS settings, and table structure.
            It helps identify if the "No API key found" error is related to database access permissions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DatabasePolicyTest;
