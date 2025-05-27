import React from 'react';
import { X } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  errors?: string[];
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, title, errors }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {errors?.map((error, index) => (
              <p key={index} className="text-sm text-danger-600 dark:text-danger-400">
                {error}
              </p>
            ))}
          </div>
        </div>
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default ImportModal;