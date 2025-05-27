import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { action, data } = await req.json();

    switch (action) {
      case 'new_member':
        // Extract first and last name from the full name
        const nameParts = (data.name || '').split(' ');
        const firstname = nameParts[0] || 'Unknown';
        const lastname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

        const { data: member, error: memberError } = await supabase
          .from('members')
          .insert([{
            firstname,
            lastname,
            email: data.email,
            status: 'ACTIVE',
            membersince: new Date().toISOString().split('T')[0],
            lastactiveonapp: new Date().toISOString(),
            isstaff: false,
            memberships: [],
            tags: [],
            trackaccess: false,
            attendancecount: 0
          }]);

        if (memberError) throw memberError;
        return new Response(JSON.stringify({ success: true, data: member }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'new_staff':
        // Extract first and last name from the full name
        const staffNameParts = (data.name || '').split(' ');
        const staffFirstname = staffNameParts[0] || 'Unknown';
        const staffLastname = staffNameParts.length > 1 ? staffNameParts.slice(1).join(' ') : 'Unknown';

        const { data: staff, error: staffError } = await supabase
          .from('members')
          .insert([{
            firstname: staffFirstname,
            lastname: staffLastname,
            email: data.email,
            phone: data.phone,
            status: 'ACTIVE',
            membersince: new Date().toISOString().split('T')[0],
            lastactiveonapp: new Date().toISOString(),
            isstaff: true,
            memberships: [data.role || 'support'],
            tags: ['staff', data.department || 'general'],
            trackaccess: true,
            attendancecount: 0
          }]);

        if (staffError) throw staffError;
        return new Response(JSON.stringify({ success: true, data: staff }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});