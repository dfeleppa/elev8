import React, { useState, useEffect } from 'react';
import { Search, Plus, Filter, Eye, Shield, Users, Download, Upload, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MemberService } from '../utils/memberService';
import { Member, MemberFilters, MEMBER_STATUSES, MEMBERSHIP_TYPES } from '../types/member';

const Members: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MemberFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [filters, searchQuery]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const data = await MemberService.getMembers({ 
        ...filters, 
        searchQuery: searchQuery || undefined 
      });
      setMembers(data);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (memberId: string) => {
    navigate(`/members/${memberId}`);
  };
  const handleToggleStaff = async (memberId: string, isCurrentlyStaff: boolean) => {
    try {
      await MemberService.toggleStaffStatus(memberId, !isCurrentlyStaff);
      fetchMembers(); // Refresh the list
    } catch (error) {
      console.error('Error toggling staff status:', error);
    }
  };
  const handleToggleAdmin = async (memberId: string, isCurrentlyAdmin: boolean) => {
    try {
      if (!isCurrentlyAdmin) {
        // Make user admin (this will also make them staff)
        await MemberService.makeUserAdmin(memberId);
      } else {
        // Remove admin status
        await MemberService.removeAdminStatus(memberId);
      }
      fetchMembers(); // Refresh the list
    } catch (error) {
      console.error('Error toggling admin status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error: ${errorMessage}`);
    }
  };
  const filteredMembers = members.filter(member => {
    const searchLower = searchQuery.toLowerCase();
    return (
      `${member.firstname} ${member.lastname}`.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      member.status.toLowerCase().includes(searchLower)
    );
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400';
      case 'inactive':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-400';
      case 'frozen':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400';
      case 'suspended':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
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
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Members Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your fitness center members and their information
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/members/new')}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200"
          >
            <Plus size={20} className="mr-2" />
            Add Member
          </button>
          <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200">
            <Upload size={20} className="mr-2" />
            Import
          </button>
          <button className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200">
            <Download size={20} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 max-w-md">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            <Filter size={20} className="mr-2" />
            Filters
          </button>
        </div>
      </div>      {/* Members Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="h-12 w-12 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Members</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{members.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Eye className="h-12 w-12 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Members</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {members.filter(member => member.status.toLowerCase() === 'active').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Shield className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Staff Members</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {members.filter(member => member.isstaff).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Crown className="h-12 w-12 text-orange-600 dark:text-orange-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Admin Members</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {members.filter(member => member.isadmin).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <Users className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">New This Month</p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {members.filter(member => {
                  const memberDate = new Date(member.membersince);
                  const now = new Date();
                  return memberDate.getMonth() === now.getMonth() && memberDate.getFullYear() === now.getFullYear();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Membership Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Member Since
                </th>                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Check-in
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {searchQuery ? 'No members match your search.' : 'No members found.'}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => handleRowClick(member.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">                        <div className="h-10 w-10 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-medium">
                          {member.firstname[0]}{member.lastname[0]}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {member.firstname} {member.lastname}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {member.memberships.length > 0 ? member.memberships.join(', ') : 'Standard'}
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {member.membersince ? new Date(member.membersince).toLocaleDateString() : 'N/A'}
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {member.lastclasscheckin ? new Date(member.lastclasscheckin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {member.isadmin ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400">
                            <Crown size={12} className="mr-1" />
                            Admin
                          </span>
                        ) : member.isstaff ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400">
                            <Shield size={12} className="mr-1" />
                            Staff
                          </span>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">Member</span>
                        )}
                      </div>
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {/* Admin Toggle Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAdmin(member.id, member.isadmin);
                          }}
                          className={`${
                            member.isadmin 
                              ? 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300' 
                              : 'text-orange-600 dark:text-orange-400 hover:text-orange-900 dark:hover:text-orange-300'
                          } text-xs font-medium`}
                          title={member.isadmin ? 'Remove admin privileges' : 'Make admin (also grants staff)'}
                        >
                          {member.isadmin ? 'Remove Admin' : 'Make Admin'}
                        </button>
                        
                        {/* Staff Toggle Button - only show if not admin */}
                        {!member.isadmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleStaff(member.id, member.isstaff);
                            }}
                            className={`${
                              member.isstaff 
                                ? 'text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300' 
                                : 'text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300'
                            } text-xs font-medium`}
                            title={member.isstaff ? 'Remove staff privileges' : 'Make staff member'}
                          >
                            {member.isstaff ? 'Remove Staff' : 'Make Staff'}
                          </button>
                        )}
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(member.id);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-xs font-medium"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filter Members</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Statuses</option>
                {MEMBER_STATUSES.map(status => (
                  <option key={status} value={status.toLowerCase()}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Membership Type</label>
              <select
                value={filters.membership || ''}
                onChange={(e) => setFilters({ ...filters, membership: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Types</option>
                {MEMBERSHIP_TYPES.map(type => (
                  <option key={type} value={type.toLowerCase()}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Staff Status</label>
              <select
                value={filters.isStaff !== undefined ? filters.isStaff.toString() : ''}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  isStaff: e.target.value === '' ? undefined : e.target.value === 'true' 
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Members</option>
                <option value="true">Staff Only</option>
                <option value="false">Non-Staff Only</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Admin Status</label>
              <select
                value={filters.isAdmin !== undefined ? filters.isAdmin.toString() : ''}
                onChange={(e) => setFilters({ 
                  ...filters, 
                  isAdmin: e.target.value === '' ? undefined : e.target.value === 'true' 
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">All Members</option>
                <option value="true">Admin Only</option>
                <option value="false">Non-Admin Only</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({})}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;