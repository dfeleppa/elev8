import React from 'react';
import { LayoutList, LayoutGrid } from 'lucide-react';

interface ViewSelectorProps {
  view: 'compact' | 'detailed';
  onChange: (view: 'compact' | 'detailed') => void;
}

const ViewSelector: React.FC<ViewSelectorProps> = ({ view, onChange }) => {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-1">
      <button
        onClick={() => onChange('compact')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded ${
          view === 'compact'
            ? 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <LayoutList size={16} />
        <span className="text-sm font-medium">Compact</span>
      </button>
      <button
        onClick={() => onChange('detailed')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded ${
          view === 'detailed'
            ? 'bg-gray-100 dark:bg-gray-600 text-gray-900 dark:text-white'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
        }`}
      >
        <LayoutGrid size={16} />
        <span className="text-sm font-medium">Detailed</span>
      </button>
    </div>
  );
};

export default ViewSelector;