import { supabase } from './supabase';
import { Member, MemberFormData, MemberFilters } from '../types/member';

export class MemberService {  /**
   * Fetch all members with optional filtering
   */
  static async getMembers(filters?: MemberFilters): Promise<Member[]> {
    try {
      let query = supabase
        .from('members')
        .select('*')
        .order('lastname', { ascending: true });      // Apply filters
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.isStaff !== undefined) {
        query = query.eq('isstaff', filters.isStaff);
      }

      if (filters?.isAdmin !== undefined) {
        query = query.eq('isadmin', filters.isAdmin);
      }

      if (filters?.membership) {
        query = query.contains('memberships', [filters.membership]);
      }

      if (filters?.tag) {
        query = query.contains('tags', [filters.tag]);
      }

      if (filters?.searchQuery) {
        const searchTerm = `%${filters.searchQuery}%`;
        query = query.or(`firstname.ilike.${searchTerm},lastname.ilike.${searchTerm},email.ilike.${searchTerm}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching members:', error);
        throw new Error(`Failed to fetch members: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getMembers:', error);
      throw error;
    }
  }

  /**
   * Fetch only staff members
   */
  static async getStaffMembers(filters?: Omit<MemberFilters, 'isStaff'>): Promise<Member[]> {
    return this.getMembers({ ...filters, isStaff: true });
  }

  /**
   * Fetch only regular members (non-staff)
   */
  static async getRegularMembers(filters?: Omit<MemberFilters, 'isStaff'>): Promise<Member[]> {
    return this.getMembers({ ...filters, isStaff: false });
  }

  /**
   * Get a single member by ID
   */
  static async getMemberById(id: string): Promise<Member | null> {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Member not found
        }
        throw new Error(`Failed to fetch member: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in getMemberById:', error);
      throw error;
    }
  }
  /**
   * Create a new member
   */
  static async createMember(memberData: MemberFormData): Promise<Member> {
    try {
      const { data, error } = await supabase
        .from('members')
        .insert([{
          firstname: memberData.firstName,
          lastname: memberData.lastName,
          email: memberData.email,
          phone: memberData.phone || null,
          gender: memberData.gender || null,
          address: memberData.address || null,
          birthdate: memberData.birthDate || null,
          status: memberData.status,
          memberships: memberData.memberships,
          tags: memberData.tags,
          trackaccess: memberData.trackAccess,
          isstaff: memberData.isStaff,
          statusnotes: memberData.statusNotes || null,
          membersince: new Date().toISOString().split('T')[0],
          attendancecount: 0,
          lastactiveonapp: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create member: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in createMember:', error);
      throw error;
    }
  }
  /**
   * Create a new member record for a newly registered user
   * This method is specifically for user registration and sets the id to match auth.uid()
   */  static async createMemberForUser(userId: string, memberData: Omit<MemberFormData, 'isStaff'>): Promise<Member> {
    try {
      console.log('Creating member for user:', userId);
      console.log('Member data:', memberData);
        const insertData = {
        id: userId, // Set the id to match the auth user ID
        firstname: memberData.firstName,
        lastname: memberData.lastName,
        email: memberData.email,
        phone: memberData.phone || null,
        gender: memberData.gender || null,
        address: memberData.address || null,
        birthdate: memberData.birthDate || null,
        status: memberData.status,
        memberships: memberData.memberships,
        tags: memberData.tags,
        trackaccess: memberData.trackAccess,
        isstaff: false, // New users are never staff by default
        isadmin: false, // New users are never admin by default
        statusnotes: memberData.statusNotes || null,
        membersince: new Date().toISOString().split('T')[0], // Add member since date
        attendancecount: 0, // Initialize attendance count
        lastactiveonapp: new Date().toISOString(), // Set last active
      };
      
      console.log('Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('members')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        throw new Error(`Failed to create member: ${error.message}`);
      }

      console.log('Member created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in createMemberForUser:', error);
      throw error;
    }
  }
  /**
   * Update an existing member
   */
  static async updateMember(id: string, memberData: Partial<MemberFormData>): Promise<Member> {
    try {
      const updateData: any = {};
      
      // Map camelCase to lowercase field names
      if (memberData.firstName !== undefined) updateData.firstname = memberData.firstName;
      if (memberData.lastName !== undefined) updateData.lastname = memberData.lastName;
      if (memberData.email !== undefined) updateData.email = memberData.email;
      if (memberData.phone !== undefined) updateData.phone = memberData.phone;
      if (memberData.gender !== undefined) updateData.gender = memberData.gender;
      if (memberData.address !== undefined) updateData.address = memberData.address;
      if (memberData.birthDate !== undefined) updateData.birthdate = memberData.birthDate;
      if (memberData.status !== undefined) updateData.status = memberData.status;
      if (memberData.memberships !== undefined) updateData.memberships = memberData.memberships;
      if (memberData.tags !== undefined) updateData.tags = memberData.tags;
      if (memberData.trackAccess !== undefined) updateData.trackaccess = memberData.trackAccess;
      if (memberData.isStaff !== undefined) updateData.isstaff = memberData.isStaff;
      if (memberData.statusNotes !== undefined) updateData.statusnotes = memberData.statusNotes;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('members')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update member: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in updateMember:', error);
      throw error;
    }
  }

  /**
   * Delete a member
   */
  static async deleteMember(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete member: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in deleteMember:', error);
      throw error;
    }
  }
  /**
   * Toggle staff status for a member
   */
  static async toggleStaffStatus(id: string, isStaff: boolean): Promise<Member> {
    try {
      const { data, error } = await supabase
        .from('members')
        .update({ 
          isstaff: isStaff,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update staff status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in toggleStaffStatus:', error);
      throw error;
    }
  }

  /**
   * Toggle admin status for a member
   */
  static async toggleAdminStatus(id: string, isAdmin: boolean): Promise<Member> {
    try {
      // First ensure the user is staff before making them admin
      if (isAdmin) {
        const member = await this.getMemberById(id);
        if (!member?.isstaff) {
          throw new Error('User must be staff before becoming admin');
        }
      }

      const { data, error } = await supabase
        .from('members')
        .update({ 
          isadmin: isAdmin,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update admin status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in toggleAdminStatus:', error);
      throw error;
    }
  }

  /**
   * Make a user both staff and admin in one step
   */
  static async makeUserAdmin(id: string): Promise<Member> {
    try {
      const { data, error } = await supabase
        .from('members')
        .update({ 
          isstaff: true,
          isadmin: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to make user admin: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in makeUserAdmin:', error);
      throw error;
    }
  }

  /**
   * Remove admin privileges (keep staff if they were staff)
   */
  static async removeAdminStatus(id: string): Promise<Member> {
    try {
      const { data, error } = await supabase
        .from('members')
        .update({ 
          isadmin: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to remove admin status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error in removeAdminStatus:', error);
      throw error;
    }
  }

  /**
   * Get all admin members
   */
  static async getAdminMembers(): Promise<Member[]> {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('isadmin', true)
        .eq('isstaff', true)
        .order('lastname', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch admin members: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAdminMembers:', error);
      throw error;
    }
  }

  /**
   * Bulk update members
   */
  static async bulkUpdateMembers(memberIds: string[], updates: Partial<MemberFormData>): Promise<Member[]> {
    try {
      const { data, error } = await supabase
        .from('members')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .in('id', memberIds)
        .select();

      if (error) {
        throw new Error(`Failed to bulk update members: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Error in bulkUpdateMembers:', error);
      throw error;
    }
  }
  /**
   * Get member statistics
   */
  static async getMemberStats() {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('status, isstaff');

      if (error) {
        throw new Error(`Failed to fetch member stats: ${error.message}`);
      }

      const stats = {
        total: data?.length || 0,
        active: data?.filter(m => m.status === 'Active').length || 0,
        staff: data?.filter(m => m.isstaff).length || 0,
        inactive: data?.filter(m => m.status === 'Inactive').length || 0,
        byStatus: {} as Record<string, number>,
      };

      // Group by status
      data?.forEach(member => {
        stats.byStatus[member.status] = (stats.byStatus[member.status] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error in getMemberStats:', error);
      throw error;
    }
  }
}
