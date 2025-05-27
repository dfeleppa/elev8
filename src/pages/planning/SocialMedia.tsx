import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { ArrowLeft, Calendar, PenTool, LineChart, Cog } from 'lucide-react';

const SocialMedia: React.FC = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Planner', href: '/planning/social-media', icon: Calendar },
    { name: 'Content', href: '/planning/social-media/content', icon: PenTool },
    { name: 'Statistics', href: '/planning/social-media/statistics', icon: LineChart },
    { name: 'Settings', href: '/planning/social-media/settings', icon: Cog },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/planning"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Social Media Planning</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage social media content and campaigns</p>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`${
                  location.pathname === item.href
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300'
                } flex items-center px-1 py-4 border-b-2 text-sm font-medium`}
              >
                <Icon size={20} className="mr-2" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
};

export default SocialMedia;