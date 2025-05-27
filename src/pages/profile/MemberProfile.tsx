import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock, Tag, Shield, CheckCircle, Save, X, Plus, Trash2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../utils/supabase';

interface Member {
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
  stripe_customer_id: string | null;
}

const memberSchema = z.object({
  firstname: z.string().min(1, 'First name is required'),
  lastname: z.string().min(1, 'Last name is required'),
  status: z.string(),
  email: z.string().email('Invalid email address'),
  phone: z.string().nullable(),
  gender: z.string().nullable(),
  address: z.string().nullable(),
  birthdate: z.string().nullable(),
  membersince: z.string(),
  trackaccess: z.boolean(),
  memberships: z.array(z.string()),
  tags: z.array(z.string()),
  statusnotes: z.string().nullable(),
  isstaff: z.boolean(),
  attendancecount: z.number(),
  lastclasscheckin: z.string().nullable(),
  lastactiveonapp: z.string().nullable(),
  stripe_customer_id: z.string().nullable(),
});

type MemberFormData = z.infer<typeof memberSchema>;

const MemberProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMembership, setNewMembership] = useState('');
  const [newTag, setNewTag] = useState('');

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  useEffect(() => {
    const fetchMember = async () => {
      if (!id) return;

      const { data, error } = await supabase
        .from('members')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Error fetching member:', error);
      } else {
        setMember(data);
        reset(data);
      }
      setLoading(false);
    };

    fetchMember();
  }, [id, reset]);

  const onSubmit = async (data: MemberFormData) => {
    if (!id) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('members')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      setMember({ ...member, ...data } as Member);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating member:', error);
    } finally {
      setSaving(false);
    }
  };

  const addMembership = () => {
    if (!newMembership.trim()) return;
    const updatedMemberships = [...(member?.memberships || []), newMembership.trim()];
    reset({ ...member, memberships: updatedMemberships } as MemberFormData);
    setNewMembership('');
  };

  const removeMembership = (index: number) => {
    const updatedMemberships = member?.memberships.filter((_, i) => i !== index);
    reset({ ...member, memberships: updatedMemberships } as MemberFormData);
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const updatedTags = [...(member?.tags || []), newTag.trim()];
    reset({ ...member, tags: updatedTags } as MemberFormData);
    setNewTag('');
  };

  const removeTag = (index: number) => {
    const updatedTags = member?.tags.filter((_, i) => i !== index);
    reset({ ...member, tags: updatedTags } as MemberFormData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Member not found</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">The requested member profile could not be found.</p>
          <Link
            to={member?.isstaff ? "/staff" : "/members"}
            className="mt-4 inline-flex items-center text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Return to list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={member.isstaff ? "/staff" : "/members"}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Member Profile</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and manage member information</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  reset(member);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-5 w-5" />
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 flex items-center justify-center text-2xl font-medium">
                  {member.firstname[0]}{member.lastname[0]}
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">First Name</label>
                      <input
                        {...register('firstname')}
                        disabled={!isEditing}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                      {errors.firstname && (
                        <p className="mt-1 text-sm text-red-600">{errors.firstname.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                      <input
                        {...register('lastname')}
                        disabled={!isEditing}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                      {errors.lastname && (
                        <p className="mt-1 text-sm text-red-600">{errors.lastname.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      {...register('status')}
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="SUSPENDED">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                    <input
                      {...register('email')}
                      type="email"
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                    {errors.email && (
                      <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input
                      {...register('phone')}
                      type="tel"
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <input
                      {...register('address')}
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                    <select
                      {...register('gender')}
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Birth Date</label>
                    <input
                      {...register('birthdate')}
                      type="date"
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Member Since</label>
                    <input
                      {...register('membersince')}
                      type="date"
                      disabled={!isEditing}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Memberships and Tags */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Memberships & Tags</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Memberships</h4>
                  <div className="flex flex-wrap gap-2">
                    <Controller
                      name="memberships"
                      control={control}
                      render={({ field }) => (
                        <>
                          {field.value?.map((membership, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 dark:bg-primary-900/20 text-primary-800 dark:text-primary-400"
                            >
                              {membership}
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => removeMembership(index)}
                                  className="ml-2 text-primary-600 hover:text-primary-700"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </span>
                          ))}
                        </>
                      )}
                    />
                  </div>
                  {isEditing && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newMembership}
                        onChange={(e) => setNewMembership(e.target.value)}
                        placeholder="Add membership"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={addMembership}
                        className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    <Controller
                      name="tags"
                      control={control}
                      render={({ field }) => (
                        <>
                          {field.value?.map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            >
                              {tag}
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={() => removeTag(index)}
                                  className="ml-2 text-gray-500 hover:text-gray-700"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </span>
                          ))}
                        </>
                      )}
                    />
                  </div>
                  {isEditing && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Add tag"
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Activity and Stats */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    {...register('trackaccess')}
                    type="checkbox"
                    disabled={!isEditing}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Track Access
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    {...register('isstaff')}
                    type="checkbox"
                    disabled={!isEditing}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Staff Member
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Stripe Customer ID
                  </label>
                  <input
                    {...register('stripe_customer_id')}
                    type="text"
                    disabled={!isEditing}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    placeholder="cus_..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Activity</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Attendance Count</label>
                  <input
                    {...register('attendancecount', { valueAsNumber: true })}
                    type="number"
                    disabled={!isEditing}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Check-in</label>
                  <input
                    {...register('lastclasscheckin')}
                    type="datetime-local"
                    disabled={!isEditing}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Active on App</label>
                  <input
                    {...register('lastactiveonapp')}
                    type="datetime-local"
                    disabled={!isEditing}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notes</h3>
              <textarea
                {...register('statusnotes')}
                disabled={!isEditing}
                rows={4}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MemberProfile;