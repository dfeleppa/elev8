import React from 'react';
import StatCard from './StatCard';
import RecentActivity from './RecentActivity';
import OverviewChart from './OverviewChart';
import QuickActions from './QuickActions';

const DashboardContent: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back, John Doe</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Revenue" 
          value="$24,560" 
          change="+12.5%" 
          trend="up" 
          color="blue"
          description="vs. last month" 
        />
        <StatCard 
          title="New Customers" 
          value="120" 
          change="+8.2%" 
          trend="up" 
          color="emerald"
          description="vs. last month" 
        />
        <StatCard 
          title="Active Orders" 
          value="32" 
          change="-4.3%" 
          trend="down" 
          color="amber"
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
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OverviewChart />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
      
      <div>
        <RecentActivity />
      </div>
    </div>
  );
};

export default DashboardContent;