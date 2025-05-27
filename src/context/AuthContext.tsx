import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';
import { MemberService } from '../utils/memberService';
import { getUserRole, UserRole } from '../utils/permissions';

interface Member {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  isadmin: boolean;
  isstaff: boolean;
  status: string;
}

interface AuthContextType {
  user: User | null;
  member: Member | null;
  userRole: UserRole;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshMemberData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('member');
  const [isLoading, setIsLoading] = useState(true);

  const ensureMemberRecord = async (user: User) => {
    try {
      console.log('🔍 Checking member record for user:', user.id);
      
      // Add a delay to ensure the session is fully established
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if member record already exists
      const existingMember = await MemberService.getMemberById(user.id);
      
      if (!existingMember) {
        console.log('🆕 Creating new member record for user:', user.email);
        
        // Create member record if it doesn't exist
        const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        const newMember = await MemberService.createMemberForUser(user.id, {
          firstName,
          lastName,
          email: user.email || '',
          status: 'Active',
          memberships: [],
          tags: [],
          trackAccess: false,
        });

        setMember(newMember);
        setUserRole(getUserRole(newMember));
        console.log('✅ Member record created successfully');
      } else {
        console.log('✅ Member record already exists');
        setMember(existingMember);
        setUserRole(getUserRole(existingMember));
      }
    } catch (error) {
      console.error('❌ Error ensuring member record exists:', error);
      // Set default member role if there's an error
      setUserRole('member');
    }
  };

  const refreshMemberData = async () => {
    if (!user) return;
    
    try {
      const memberData = await MemberService.getMemberById(user.id);
      setMember(memberData);
      setUserRole(getUserRole(memberData));
    } catch (error) {
      console.error('Error refreshing member data:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      // Ensure member record exists for authenticated user
      if (currentUser) {
        ensureMemberRecord(currentUser);
      } else {
        setMember(null);
        setUserRole('member');
      }
      
      setIsLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        await ensureMemberRecord(currentUser);
      } else if (event === 'SIGNED_OUT') {
        setMember(null);
        setUserRole('member');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null);
    setUserRole('member');
  };

  return (
    <AuthContext.Provider value={{ user, member, userRole, isLoading, signOut, refreshMemberData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};