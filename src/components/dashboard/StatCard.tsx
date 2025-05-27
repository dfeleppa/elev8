import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingBag, BarChart } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  color: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose';
  description: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, trend, color, description }) => {
  const getIcon = () => {
    switch (title.toLowerCase()) {
      case 'total revenue':
        return <DollarSign size={20} />;
      case 'new customers':
        return <Users size={20} />;
      case 'active orders':
        return <ShoppingBag size={20} />;
      case 'conversion rate':
        return <BarChart size={20} />;
      default:
        return <BarChart size={20} />;
    }
  };

  const getIconBackgroundColor = () => {
    switch (color) {
      case 'blue':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
      case 'emerald':
        return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400';
      case 'amber':
        return 'bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400';
      case 'indigo':
        return 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400';
      case 'rose':
        return 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400';
      default:
        return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400';
    }
  };

  const getTrendColor = () => {
    return trend === 'up' 
      ? 'text-emerald-500 dark:text-emerald-400' 
      : 'text-rose-500 dark:text-rose-400';
  };

  const getTrendIcon = () => {
    return trend === 'up' 
      ? <TrendingUp size={16} className="ml-1" /> 
      : <TrendingDown size={16} className="ml-1" />;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${getIconBackgroundColor()}`}>
          {getIcon()}
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
        <div className="mt-2 flex items-baseline">
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center">
        <span className={`flex items-center text-sm ${getTrendColor()}`}>
          {change}
          {getTrendIcon()}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{description}</span>
      </div>
    </div>
  );
};

export default StatCard;