// Quick script to make a user admin
import { supabase } from '../src/utils/supabase.ts';

const makeUserAdmin = async (userEmail) => {
  try {
    console.log('🔍 Looking for user:', userEmail);
    
    // Find the user by email
    const { data: members, error: fetchError } = await supabase
      .from('members')
      .select('*')
      .eq('email', userEmail);
    
    if (fetchError) {
      console.error('Error fetching user:', fetchError);
      return;
    }
    
    if (members.length === 0) {
      console.log('❌ No user found with email:', userEmail);
      return;
    }
    
    const member = members[0];
    console.log('✅ Found user:', member.firstname, member.lastname);
    
    // Make them admin (and staff)
    const { data, error } = await supabase
      .from('members')
      .update({ 
        isadmin: true,
        isstaff: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', member.id)
      .select();
    
    if (error) {
      console.error('❌ Error updating user:', error);
      return;
    }
    
    console.log('🎉 Successfully made user admin!', data[0]);
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
};

// Replace with your email
const userEmail = 'your-email@example.com'; // <-- CHANGE THIS TO YOUR EMAIL
makeUserAdmin(userEmail);
