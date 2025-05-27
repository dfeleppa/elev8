import React from 'react';
import { Calendar, Image, Link as LinkIcon, Video } from 'lucide-react';

const Content: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200 text-left">
          <div className="flex items-center justify-between mb-4">
            <Image className="text-blue-500 dark:text-blue-400" size={24} />
            <span className="text-xs text-gray-500 dark:text-gray-400">Image Post</span>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Create Image Post</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Share photos and graphics</p>
        </button>

        <button className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200 text-left">
          <div className="flex items-center justify-between mb-4">
            <Video className="text-blue-500 dark:text-blue-400" size={24} />
            <span className="text-xs text-gray-500 dark:text-gray-400">Video Post</span>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Create Video Post</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Share videos and reels</p>
        </button>

        <button className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200 text-left">
          <div className="flex items-center justify-between mb-4">
            <LinkIcon className="text-blue-500 dark:text-blue-400" size={24} />
            <span className="text-xs text-gray-500 dark:text-gray-400">Link Post</span>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Create Link Post</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Share links and articles</p>
        </button>

        <button className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors duration-200 text-left">
          <div className="flex items-center justify-between mb-4">
            <Calendar className="text-blue-500 dark:text-blue-400" size={24} />
            <span className="text-xs text-gray-500 dark:text-gray-400">Schedule Post</span>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Schedule Content</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Plan future posts</p>
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Scheduled Posts</h2>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400 py-6">
            <p>No scheduled posts yet</p>
            <p className="text-sm mt-1">Create a new post to get started</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Content;