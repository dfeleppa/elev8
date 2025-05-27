import React from 'react';
import { Users, Eye, Heart, Share2 } from 'lucide-react';

const Statistics: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Followers</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">1,234</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-green-600 dark:text-green-400">
              +2.5% from last week
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <Eye className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Profile Views</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">5,678</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-green-600 dark:text-green-400">
              +4.2% from last week
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/20 rounded-lg">
              <Heart className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Engagement</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">12.4%</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-red-600 dark:text-red-400">
              -1.2% from last week
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg">
              <Share2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Shares</p>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">234</h3>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-sm text-green-600 dark:text-green-400">
              +3.1% from last week
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Performance Overview</h2>
        </div>
        <div className="p-6">
          <div className="text-center text-gray-500 dark:text-gray-400 py-6">
            <p>Connect your social media accounts to view analytics</p>
            <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200">
              Connect Accounts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;