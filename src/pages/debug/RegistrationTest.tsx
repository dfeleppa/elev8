import React, { useState } from 'react';
import { supabase } from '../../utils/supabase';
import { MemberService } from '../../utils/memberService';

const RegistrationTest: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prev => [...prev, logMessage]);
  };

  const testRegistrationFlow = async () => {
    setLoading(true);
    setLogs([]);
    
    const testEmail = `test-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';
    const testFirstName = 'Test';
    const testLastName = 'User';

    try {
      log('🚀 Starting registration test flow...');
        // Step 1: Test Supabase client
      log('1️⃣ Testing Supabase client connection...');
      const { error: healthError } = await supabase
        .from('members')
        .select('count', { count: 'exact', head: true });
      
      if (healthError) {
        log(`❌ Supabase connection failed: ${JSON.stringify(healthError)}`);
        return;
      } else {
        log('✅ Supabase connection successful');
      }

      // Step 2: Test auth signup
      log('2️⃣ Testing auth signup...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            first_name: testFirstName,
            last_name: testLastName,
          }
        }
      });

      if (authError) {
        log(`❌ Auth signup failed: ${JSON.stringify(authError)}`);
        return;
      } else {
        log(`✅ Auth signup successful. User ID: ${authData.user?.id}`);
      }

      // Step 3: Test member record creation using service
      if (authData.user?.id) {
        log('3️⃣ Testing member record creation via MemberService...');
        try {
          const memberResult = await MemberService.createMemberForUser(authData.user.id, {
            firstName: testFirstName,
            lastName: testLastName,
            email: testEmail,
            status: 'Active',
            memberships: [],
            tags: [],
            trackAccess: false,
          });
          log(`✅ Member service creation successful: ${JSON.stringify(memberResult)}`);
        } catch (memberError: any) {
          log(`❌ Member service creation failed: ${JSON.stringify(memberError)}`);
          
          // Step 4: Test direct database insert
          log('4️⃣ Testing direct database insert...');
          try {
            const { data: directData, error: directError } = await supabase
              .from('members')
              .insert({
                id: authData.user.id,
                firstname: testFirstName,
                lastname: testLastName,
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
            
            if (directError) {
              log(`❌ Direct insert failed: ${JSON.stringify(directError)}`);
            } else {
              log(`✅ Direct insert successful: ${JSON.stringify(directData)}`);
            }
          } catch (directException) {
            log(`❌ Direct insert exception: ${JSON.stringify(directException)}`);
          }
        }
      }

      // Step 5: Clean up test user
      log('5️⃣ Cleaning up test data...');
      if (authData.user?.id) {
        // Delete member record if it exists
        await supabase
          .from('members')
          .delete()
          .eq('id', authData.user.id);
        
        // Note: Can't delete auth user via client, would need admin API
        log('✅ Cleanup completed (member record deleted)');
      }

    } catch (error) {
      log(`❌ Test flow exception: ${JSON.stringify(error)}`);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Registration Flow Test</h1>
        
        <div className="mb-6 space-x-4">
          <button
            onClick={testRegistrationFlow}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Running Test...' : 'Test Registration Flow'}
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
            <div className="text-gray-500">Click "Test Registration Flow" to start debugging...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="mb-1">{log}</div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Test Information</h3>
          <p className="text-sm text-yellow-700">
            This test will create a temporary user account and attempt to create a member record.
            The test user will be cleaned up automatically (member record deleted).
            Check the console logs for detailed error information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegistrationTest;
