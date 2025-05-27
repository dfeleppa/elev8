import React from 'react';
import { 
  ShoppingBag, 
  User, 
  AlertCircle, 
  CheckCircle,
  Clock 
} from 'lucide-react';

const RecentActivity: React.FC = () => {
  const activities = [
    {
      id: 1,
      type: 'order',
      title: 'New order placed',
      description: 'Order #12345 was placed by John Smith',
      time: '10 minutes ago',
      icon: <ShoppingBag size={16} />
    },
    {
      id: 2,
      type: 'user',
      title: 'New customer registered',
      description: 'Jane Doe created a new account',
      time: '1 hour ago',
      icon: <User size={16} />
    },
    {
      id: 3,
      type: 'alert',
      title: 'Low inventory alert',
      description: 'Product "Wireless Headphones" is running low',
      time: '2 hours ago',
      icon: <AlertCircle size={16} />
    },
    {
      id: 4,
      type: 'success',
      title: 'Order shipped',
      description: 'Order #12340 was shipped to customer',
      time: '3 hours ago',
      icon: <CheckCircle size={16} />
    },
    {
      id: 5,
      type: 'pending',
      title: 'Payment pending',
      description: 'Order #12339 is awaiting payment confirmation',
      time: '5 hours ago',
      icon: <Clock size={16} />
    }
  ];

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'order':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
      case 'user':
        return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
      case 'alert':
        return 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400';
      case 'success':
        return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400';
      case 'pending':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h2>
        <button className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          View all
        </button>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start">
            <div className={`p-2 rounded-full ${getTypeStyles(activity.type)} mr-4 mt-1`}>
              {activity.icon}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">{activity.title}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{activity.description}</p>
              <span className="text-xs text-gray-400 dark:text-gray-500">{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;