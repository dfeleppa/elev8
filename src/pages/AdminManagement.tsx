import React, { useState, useEffect } from 'react';
import { Crown, Shield, Users, UserCheck, UserX, Search, AlertTriangle } from 'lucide-react';
import { MemberService } from '../utils/memberService';
import { Member } from '../types/member';

const AdminManagement: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [adminMembers, setAdminMembers] = useState<Member[]>([]);
  const [staffMembers, setStaffMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'admins' | 'staff' | 'promote'>('overview');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allMembers, admins, staff] = await Promise.all([
        MemberService.getMembers(),
        MemberService.getAdminMembers(),
        MemberService.getStaffMembers()
      ]);
      
      setMembers(allMembers);
      setAdminMembers(admins);
      setStaffMembers(staff);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMakeAdmin = async (memberId: string) => {
    try {
      await MemberService.makeUserAdmin(memberId);
      await fetchData(); // Refresh data
      alert('User has been successfully promoted to admin!');
    } catch (error) {
      console.error('Error making user admin:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error: ${errorMessage}`);
    }
  };

  const handleRemoveAdmin = async (memberId: string) => {
    if (window.confirm('Are you sure you want to remove admin privileges from this user?')) {
      try {
        await MemberService.removeAdminStatus(memberId);
        await fetchData(); // Refresh data
        alert('Admin privileges have been removed successfully!');
      } catch (error) {
        console.error('Error removing admin:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Error: ${errorMessage}`);
      }
    }
  };

  const handleToggleStaff = async (memberId: string, isCurrentlyStaff: boolean) => {
    try {
      await MemberService.toggleStaffStatus(memberId, !isCurrentlyStaff);
      await fetchData(); // Refresh data
    } catch (error) {
      console.error('Error toggling staff status:', error);
    }
  };

  // Filter members for promotion (non-staff, non-admin members)
  const eligibleForPromotion = members.filter(member => 
    !member.isstaff && !member.isadmin &&
    (searchQuery === '' || 
     `${member.firstname} ${member.lastname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
     member.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const renderMemberCard = (member: Member, showActions: boolean = true) => (
    <div key={member.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-medium text-lg">
            {member.firstname[0]}{member.lastname[0]}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {member.firstname} {member.lastname}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
            <div className="flex items-center space-x-2 mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                member.status.toLowerCase() === 'active' 
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400'
              }`}>
                {member.status}
              </span>
              {member.isadmin && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400">
                  <Crown size={10} className="mr-1" />
                  Admin
                </span>
              )}
              {member.isstaff && !member.isadmin && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400">
                  <Shield size={10} className="mr-1" />
                  Staff
                </span>
              )}
            </div>
          </div>
        </div>
        
        {showActions && (
          <div className="flex items-center space-x-2">
            {!member.isadmin && !member.isstaff && (
              <>
                <button
                  onClick={() => handleToggleStaff(member.id, false)}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Make Staff
                </button>
                <button
                  onClick={() => handleMakeAdmin(member.id)}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Make Admin
                </button>
              </>
            )}
            {member.isstaff && !member.isadmin && (
              <>
                <button
                  onClick={() => handleMakeAdmin(member.id)}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Promote to Admin
                </button>
                <button
                  onClick={() => handleToggleStaff(member.id, true)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                >
                  Remove Staff
                </button>
              </>
            )}
            {member.isadmin && (
              <button
                onClick={() => handleRemoveAdmin(member.id)}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
              >
                Remove Admin
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage administrator and staff privileges for your gym members
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Crown className="h-12 w-12 text-orange-600 dark:text-orange-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Admins</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{adminMembers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Shield className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Staff</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{staffMembers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Regular Members</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {members.filter(m => !m.isstaff && !m.isadmin).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <UserCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Eligible for Promotion</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{eligibleForPromotion.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Overview', icon: Users },
            { id: 'admins', label: 'Administrators', icon: Crown },
            { id: 'staff', label: 'Staff Members', icon: Shield },
            { id: 'promote', label: 'Promote Members', icon: UserCheck }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Administrators</h3>
              <div className="space-y-4">
                {adminMembers.slice(0, 3).map(member => renderMemberCard(member, false))}
                {adminMembers.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No administrators found</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Recent Staff Members</h3>
              <div className="space-y-4">
                {staffMembers.filter(m => !m.isadmin).slice(0, 3).map(member => renderMemberCard(member, false))}
                {staffMembers.filter(m => !m.isadmin).length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No staff members found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">All Administrators</h3>
              {adminMembers.length > 0 && (
                <div className="flex items-center space-x-2 text-sm text-orange-600 dark:text-orange-400">
                  <AlertTriangle size={16} />
                  <span>Handle admin privileges carefully</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {adminMembers.map(member => renderMemberCard(member))}
              {adminMembers.length === 0 && (
                <div className="text-center py-12">
                  <Crown className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No administrators found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Staff Members</h3>
            <div className="space-y-4">
              {staffMembers.filter(m => !m.isadmin).map(member => renderMemberCard(member))}
              {staffMembers.filter(m => !m.isadmin).length === 0 && (
                <div className="text-center py-12">
                  <Shield className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No staff members found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'promote' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Promote Members</h3>
              <div className="relative max-w-md">
                <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="space-y-4">
              {eligibleForPromotion.map(member => renderMemberCard(member))}
              {eligibleForPromotion.length === 0 && (
                <div className="text-center py-12">
                  <UserX className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No members match your search' : 'No members eligible for promotion'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManagement;
