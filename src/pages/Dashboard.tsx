import React from 'react';
import { Users } from 'lucide-react';
import StatCard from '../components/dashboard/StatCard';
import OverviewChart from '../components/dashboard/OverviewChart';

const Dashboard: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back, John Doe</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard 
          title="Total Revenue" 
          value="$24,560" 
          change="+12.5%" 
          trend="up" 
          color="blue"
          description="vs. last month" 
        />
        <StatCard 
          title="Total Members" 
          value="450" 
          change="+8.2%" 
          trend="up" 
          color="emerald"
          description="vs. last month" 
        />
        <StatCard 
          title="Conversion Rate" 
          value="3.8%" 
          change="+2.1%" 
          trend="up" 
          color="indigo"
          description="vs. last month" 
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverviewChart />
        
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Inactive Members</h2>
            <div className="space-y-3">
              {[
                { name: 'Sarah Wilson', lastAttended: '14 days ago' },
                { name: 'Mike Johnson', lastAttended: '12 days ago' },
                { name: 'Emma Davis', lastAttended: '10 days ago' }
              ].map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <Users size={16} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Last attended {member.lastAttended}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming Birthdays</h2>
            <div className="space-y-3">
              {[
                { name: 'John Smith', date: 'March 25' },
                { name: 'Lisa Anderson', date: 'March 27' },
                { name: 'David Wilson', date: 'March 30' }
              ].map((member, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <Users size={16} className="text-gray-600 dark:text-gray-300" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Birthday: {member.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;