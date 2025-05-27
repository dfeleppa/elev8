import React from 'react';
import { 
  PlusCircle, 
  FileText, 
  Download, 
  RefreshCw 
} from 'lucide-react';

const QuickActions: React.FC = () => {
  const actions = [
    { 
      icon: <PlusCircle size={20} />, 
      title: 'New Order', 
      description: 'Create a new customer order',
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    { 
      icon: <FileText size={20} />, 
      title: 'Generate Report', 
      description: 'Download sales and inventory stats',
      color: 'bg-emerald-500 hover:bg-emerald-600'
    },
    { 
      icon: <RefreshCw size={20} />, 
      title: 'Sync Inventory', 
      description: 'Update stock levels across channels',
      color: 'bg-amber-500 hover:bg-amber-600'
    },
    { 
      icon: <Download size={20} />, 
      title: 'Export Data', 
      description: 'Download customer and order data',
      color: 'bg-indigo-500 hover:bg-indigo-600'
    }
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 h-full">
      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Quick Actions</h2>
      
      <div className="space-y-3">
        {actions.map((action, index) => (
          <button
            key={index}
            className={`${action.color} text-white w-full py-3 px-4 rounded-lg transition-colors duration-200 text-left flex items-center`}
          >
            <span className="mr-3">{action.icon}</span>
            <div>
              <p className="font-medium">{action.title}</p>
              <p className="text-xs text-white/80">{action.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuickActions;