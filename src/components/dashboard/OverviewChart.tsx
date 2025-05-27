import React, { useState } from 'react';

const OverviewChart: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // This is a placeholder for the chart data
  // In a real app, you would fetch this data from an API
  const chartData = {
    daily: [
      { day: 'Mon', value: 25 },
      { day: 'Tue', value: 38 },
      { day: 'Wed', value: 32 },
      { day: 'Thu', value: 45 },
      { day: 'Fri', value: 50 },
      { day: 'Sat', value: 30 },
      { day: 'Sun', value: 22 },
    ],
    weekly: [
      { week: 'Week 1', value: 120 },
      { week: 'Week 2', value: 145 },
      { week: 'Week 3', value: 132 },
      { week: 'Week 4', value: 165 },
    ],
    monthly: [
      { month: 'Jan', value: 420 },
      { month: 'Feb', value: 380 },
      { month: 'Mar', value: 450 },
      { month: 'Apr', value: 520 },
      { month: 'May', value: 490 },
      { month: 'Jun', value: 560 },
    ],
  };
  
  // Get the maximum value for the current timeRange to scale the chart
  const maxValue = Math.max(
    ...chartData[timeRange].map(item => item.value)
  );
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Revenue Overview</h2>
        <div className="flex space-x-2">
          <button 
            onClick={() => setTimeRange('daily')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === 'daily' 
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            } transition-colors duration-200`}
          >
            Daily
          </button>
          <button 
            onClick={() => setTimeRange('weekly')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === 'weekly' 
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            } transition-colors duration-200`}
          >
            Weekly
          </button>
          <button 
            onClick={() => setTimeRange('monthly')}
            className={`px-3 py-1 text-sm rounded-md ${
              timeRange === 'monthly' 
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            } transition-colors duration-200`}
          >
            Monthly
          </button>
        </div>
      </div>
      
      <div className="h-72">
        <div className="flex h-full items-end space-x-2">
          {chartData[timeRange].map((item, index) => {
            const height = (item.value / maxValue) * 100;
            const label = 
              timeRange === 'daily' 
                ? item.day 
                : timeRange === 'weekly' 
                  ? item.week 
                  : item.month;
            
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div 
                  className="w-full bg-blue-500 dark:bg-blue-600 rounded-t-md transition-all duration-500 ease-in-out hover:bg-blue-600 dark:hover:bg-blue-500"
                  style={{ height: `${height}%` }}
                ></div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OverviewChart;