import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Pencil, Trash2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../utils/supabase';

interface Track {
  id: string;
  name: string;
  is_private: boolean;
  num_levels: number;
  level_colors: string[];
  workout_reveal_delay?: string;
}

const trackSchema = z.object({
  name: z.string().min(1, 'Track name is required'),
  is_private: z.boolean(),
  num_levels: z.number().min(1).max(3),
  level_colors: z.array(z.string()),
  workout_reveal_delay: z.string().optional(),
});

type TrackFormData = z.infer<typeof trackSchema>;

const defaultColors = ['#3B82F6', '#10B981', '#F59E0B'];

const ProgrammingSetup: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'import'>('info');
  const [searchQuery, setSearchQuery] = useState('');

  const { register, handleSubmit, reset, setValue, watch, control, formState: { errors } } = useForm<TrackFormData>({
    resolver: zodResolver(trackSchema),
    defaultValues: {
      is_private: false,
      num_levels: 1,
      level_colors: [defaultColors[0]],
    },
  });

  const numLevels = watch('num_levels');

  useEffect(() => {
    // Update level_colors array when num_levels changes
    const colors = defaultColors.slice(0, numLevels);
    setValue('level_colors', colors);
  }, [numLevels, setValue]);

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    const { data, error } = await supabase
      .from('tracks')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching tracks:', error);
    } else {
      setTracks(data || []);
    }
  };

  const onSubmit = async (data: TrackFormData) => {
    try {
      if (editingTrack) {
        const { error } = await supabase
          .from('tracks')
          .update(data)
          .eq('id', editingTrack.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tracks')
          .insert([data]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingTrack(null);
      reset();
      fetchTracks();
    } catch (error) {
      console.error('Error saving track:', error);
    }
  };

  const handleEdit = (track: Track) => {
    setEditingTrack(track);
    setValue('name', track.name);
    setValue('is_private', track.is_private);
    setValue('num_levels', track.num_levels);
    setValue('level_colors', track.level_colors);
    setValue('workout_reveal_delay', track.workout_reveal_delay || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('tracks')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting track:', error);
    } else {
      fetchTracks();
    }
  };

  const filteredTracks = tracks.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Programming Setup</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage programming tracks</p>
        </div>
        <button
          onClick={() => {
            setEditingTrack(null);
            reset({
              is_private: false,
              num_levels: 1,
              level_colors: [defaultColors[0]],
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 flex items-center gap-2"
        >
          <Plus size={20} />
          New Track
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="relative flex-1 max-w-md">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <button className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2">
          <Filter size={20} />
          Filters
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTracks.map((track) => (
          <div
            key={track.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">{track.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(track)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(track.id)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Private:</span>
                <span className="text-gray-900 dark:text-white">{track.is_private ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Levels:</span>
                <span className="text-gray-900 dark:text-white">{track.num_levels}</span>
              </div>
              {track.workout_reveal_delay && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Reveal Delay:</span>
                  <span className="text-gray-900 dark:text-white">{track.workout_reveal_delay}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-4">
                {track.level_colors.map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingTrack ? 'Edit Track' : 'New Track'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                <button
                  onClick={() => setActiveTab('info')}
                  className={`px-4 py-2 ${
                    activeTab === 'info'
                      ? 'border-b-2 border-primary-600 text-primary-600'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Track Info
                </button>
                <button
                  onClick={() => setActiveTab('members')}
                  className={`px-4 py-2 ${
                    activeTab === 'members'
                      ? 'border-b-2 border-primary-600 text-primary-600'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Members
                </button>
                <button
                  onClick={() => setActiveTab('import')}
                  className={`px-4 py-2 ${
                    activeTab === 'import'
                      ? 'border-b-2 border-primary-600 text-primary-600'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Import/Export
                </button>
              </div>

              {activeTab === 'info' && (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Track Name
                    </label>
                    <input
                      {...register('name')}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('is_private')}
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900 dark:text-white">
                      Private Track
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Number of Levels
                    </label>
                    <select
                      {...register('num_levels', { valueAsNumber: true })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={1}>1 Level</option>
                      <option value={2}>2 Levels</option>
                      <option value={3}>3 Levels</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Level Colors
                    </label>
                    <Controller
                      name="level_colors"
                      control={control}
                      render={({ field }) => (
                        <div className="flex gap-4">
                          {Array.from({ length: numLevels }).map((_, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="color"
                                value={field.value[index] || defaultColors[index]}
                                onChange={(e) => {
                                  const newColors = [...field.value];
                                  newColors[index] = e.target.value;
                                  field.onChange(newColors);
                                }}
                                className="w-8 h-8 rounded cursor-pointer"
                              />
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                Level {index + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Workout Reveal Delay
                    </label>
                    <input
                      {...register('workout_reveal_delay')}
                      type="text"
                      placeholder="e.g., 2 days"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                    >
                      {editingTrack ? 'Update' : 'Create'} Track
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'members' && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Member management will be implemented in the next phase
                </div>
              )}

              {activeTab === 'import' && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Import/Export functionality will be implemented in the next phase
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgrammingSetup;