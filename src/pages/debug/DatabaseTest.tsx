import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { MemberService } from '../../utils/memberService';

const DatabaseTest: React.FC = () => {
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addResult = (message: string) => {
    setResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const clearResults = () => {
    setResults([]);
  };

  const testDatabaseConnectivity = async () => {
    setLoading(true);
    addResult('Testing database connectivity...');
      try {
      const { error } = await supabase
        .from('members')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        addResult(`❌ Connectivity test failed: ${error.message}`);
      } else {
        addResult('✅ Database connectivity successful');
      }
    } catch (error: any) {
      addResult(`❌ Connectivity test exception: ${error.message}`);
    }
    setLoading(false);
  };

  const testCurrentUser = async () => {
    setLoading(true);
    addResult('Testing current user...');
    
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        addResult(`❌ User test failed: ${error.message}`);
      } else if (user) {
        addResult(`✅ Current user: ${user.id} (${user.email})`);
      } else {
        addResult('⚠️ No current user');
      }
    } catch (error: any) {
      addResult(`❌ User test exception: ${error.message}`);
    }
    setLoading(false);
  };

  const testMemberTableAccess = async () => {
    setLoading(true);
    addResult('Testing member table access...');
    
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .limit(1);
      
      if (error) {
        addResult(`❌ Table access failed: ${error.message}`);
      } else {
        addResult(`✅ Table access successful, sample data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      addResult(`❌ Table access exception: ${error.message}`);
    }
    setLoading(false);
  };

  const testMemberCreation = async () => {
    setLoading(true);
    addResult('Testing member creation...');
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        addResult('❌ No authenticated user for member creation test');
        setLoading(false);
        return;
      }

      // First try direct insert
      addResult('Attempting direct database insert...');
      const { data: directData, error: directError } = await supabase
        .from('members')
        .insert({
          id: user.id,
          firstname: 'Test',
          lastname: 'User',
          email: user.email || 'test@example.com',
          status: 'Active',
          memberships: [],
          tags: [],
          trackaccess: false,
          isstaff: false,
          membersince: new Date().toISOString().split('T')[0],
          attendancecount: 0,
          lastactiveonapp: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (directError) {
        addResult(`❌ Direct insert failed: ${directError.message}`);
        addResult(`Code: ${directError.code}, Details: ${directError.details}`);
      } else {
        addResult(`✅ Direct insert successful: ${JSON.stringify(directData)}`);
      }

      // Try MemberService method
      addResult('Attempting MemberService.createMemberForUser...');
      try {
        const memberResult = await MemberService.createMemberForUser(user.id, {
          firstName: 'Test2',
          lastName: 'User2',
          email: user.email || 'test2@example.com',
          status: 'Active',
          memberships: [],
          tags: [],
          trackAccess: false,
        });
        addResult(`✅ MemberService creation successful: ${JSON.stringify(memberResult)}`);
      } catch (serviceError: any) {
        addResult(`❌ MemberService creation failed: ${serviceError.message}`);
      }

    } catch (error: any) {
      addResult(`❌ Member creation test exception: ${error.message}`);
    }
    setLoading(false);
  };

  const testRLSPolicies = async () => {
    setLoading(true);
    addResult('Testing RLS policies...');
    
    try {
      // Test if we can query our own data
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        addResult('❌ No user for RLS test');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', user.id);
      
      if (error) {
        addResult(`❌ RLS test failed: ${error.message}`);
      } else {
        addResult(`✅ RLS test passed, found ${data.length} records for current user`);
      }
    } catch (error: any) {
      addResult(`❌ RLS test exception: ${error.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Debug Console</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <button
            onClick={testDatabaseConnectivity}
            disabled={loading}
            className="p-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            Test DB Connectivity
          </button>
          
          <button
            onClick={testCurrentUser}
            disabled={loading}
            className="p-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            Test Current User
          </button>
          
          <button
            onClick={testMemberTableAccess}
            disabled={loading}
            className="p-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
          >
            Test Table Access
          </button>
          
          <button
            onClick={testRLSPolicies}
            disabled={loading}
            className="p-4 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
          >
            Test RLS Policies
          </button>
          
          <button
            onClick={testMemberCreation}
            disabled={loading}
            className="p-4 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            Test Member Creation
          </button>
          
          <button
            onClick={clearResults}
            className="p-4 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm">
            {results.length === 0 ? (
              <div className="text-gray-500">No tests run yet. Click a button above to start testing.</div>
            ) : (
              results.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Manual RLS Fix</h3>
          <p className="text-yellow-700 mb-3">
            If member creation is failing due to RLS policies, you may need to manually apply the RLS fix in the Supabase dashboard.
          </p>
          <p className="text-yellow-700 mb-3">
            Go to your Supabase project → SQL Editor and run the contents of: <code>manual_fix_rls_policies.sql</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DatabaseTest;
