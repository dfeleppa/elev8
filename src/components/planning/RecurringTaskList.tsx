import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { RecurringTask } from '../../types/planning';

interface RecurringTaskListProps {
  title: string;
  tasks: RecurringTask[];
  onAddTask: (task: Omit<RecurringTask, 'id'>) => void;
  onDeleteTask: (id: string) => void;
}

const RecurringTaskList: React.FC<RecurringTaskListProps> = ({
  title,
  tasks,
  onAddTask,
  onDeleteTask,
}) => {
  const [newTask, setNewTask] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.trim()) {
      onAddTask({
        text: newTask.trim(),
        frequency,
        ...(frequency === 'weekly' ? { dayOfWeek } : {}),
        ...(frequency === 'monthly' ? { day: dayOfMonth } : {}),
      });
      setNewTask('');
    }
  };

  const getDayName = (day: number) => {
    return new Date(2024, 0, day + 1).toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      
      <form onSubmit={handleSubmit} className="mb-4 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a new recurring task..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-4">
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          {frequency === 'weekly' && (
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <option key={day} value={day}>
                  {getDayName(day)}
                </option>
              ))}
            </select>
          )}

          {frequency === 'monthly' && (
            <select
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  Day {day}
                </option>
              ))}
            </select>
          )}

          <button
            type="submit"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors duration-200 flex items-center"
          >
            <Plus size={20} />
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900 dark:text-white">
                  {task.text}
                </span>
                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {task.frequency === 'daily' && 'Repeats daily'}
                {task.frequency === 'weekly' && `Repeats every ${getDayName(task.dayOfWeek!)}`}
                {task.frequency === 'monthly' && `Repeats on day ${task.day} of each month`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecurringTaskList;