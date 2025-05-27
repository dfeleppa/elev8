export interface Member {
  id: string;
  firstname: string;
  lastname: string;
  status: string;
  memberships: string[];
  tags: string[];
  trackaccess: boolean;
  email: string;
  phone: string | null;
  gender: string | null;
  address: string | null;
  birthdate: string | null;
  membersince: string;
  attendancecount: number;
  lastclasscheckin: string | null;
  lastactiveonapp: string | null;
  statusnotes: string | null;
  isstaff: boolean;
  isadmin: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  address?: string;
  birthDate?: string;
  status: string;
  memberships: string[];
  tags: string[];
  trackAccess: boolean;
  isStaff: boolean;
  statusNotes?: string;
}

export interface MemberFilters {
  status?: string;
  membership?: string;
  tag?: string;
  isStaff?: boolean;
  isAdmin?: boolean;
  searchQuery?: string;
}

export const MEMBER_STATUSES = [
  'Active',
  'Inactive',
  'Frozen',
  'Cancelled',
  'Pending',
  'Trial'
] as const;

export const MEMBERSHIP_TYPES = [
  'Basic',
  'Premium',
  'Elite',
  'Student',
  'Senior',
  'Staff',
  'Unlimited'
] as const;

export const STAFF_ROLES = [
  'Owner',
  'Manager',
  'Trainer',
  'Instructor',
  'Front Desk',
  'Maintenance'
] as const;

export type MemberStatus = typeof MEMBER_STATUSES[number];
export type MembershipType = typeof MEMBERSHIP_TYPES[number];
export type StaffRole = typeof STAFF_ROLES[number];
