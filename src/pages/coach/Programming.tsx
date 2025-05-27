import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Filter } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Track {
  id: string;
  name: string;
  is_private: boolean;
  num_levels: number;
  level_colors: string[];
  workout_reveal_delay?: string;
}

const Programming: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) {
        setError('No authenticated user found');
        return;
      }

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('trackaccess')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (memberError) throw memberError;

      // If no member data is found, just fetch public tracks
      const query = supabase
        .from('tracks')
        .select('*')
        .order('name');

      if (memberData?.trackaccess) {
        query.or(`is_private.eq.false,id.eq.${memberData.trackaccess}`);
      } else {
        query.eq('is_private', false);
      }

      const { data: tracksData, error: tracksError } = await query;
      
      if (tracksError) throw tracksError;
      
      setTracks(tracksData || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching tracks:', err);
      setError('Failed to load tracks. Please try again later.');
      setTracks([]);
    }
  };

  const filteredTracks = tracks.filter(track =>
    track.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Programming</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View and manage workout programs</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

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
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/20 rounded-lg">
                  <ClipboardList className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{track.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {track.num_levels} {track.num_levels === 1 ? 'Level' : 'Levels'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Access:</span>
                <span className="text-gray-900 dark:text-white">
                  {track.is_private ? 'Private' : 'Public'}
                </span>
              </div>
              {track.workout_reveal_delay && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Reveal Delay:</span>
                  <span className="text-gray-900 dark:text-white">{track.workout_reveal_delay}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="w-full px-4 py-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors duration-200">
                View Workouts
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Programming;