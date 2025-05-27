import React, { useState, useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import RecurringTaskList from '../../../components/planning/RecurringTaskList';
import type { RecurringTask } from '../../../types/planning';

interface WeeklyTask {
  id: string;
  text: string;
  completed: boolean;
  date: Date;
  recurringTaskId: string;
}

const Planner: React.FC = () => {
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([
    {
      id: '1',
      text: 'Post Instagram Story',
      frequency: 'daily',
    },
    {
      id: '2',
      text: 'Schedule Content for Next Week',
      frequency: 'weekly',
      dayOfWeek: 5, // Friday
    },
    {
      id: '3',
      text: 'Social Media Analytics Review',
      frequency: 'monthly',
      day: 1,
    }
  ]);

  const [weeklyTasks, setWeeklyTasks] = useState<WeeklyTask[]>([]);

  useEffect(() => {
    generateWeeklyTasks();
  }, [recurringTasks]);

  const generateWeeklyTasks = () => {
    const tasks: WeeklyTask[] = [];
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay()); // Get last Sunday

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(sunday);
      currentDate.setDate(sunday.getDate() + i);

      recurringTasks.forEach(task => {
        if (
          task.frequency === 'daily' ||
          (task.frequency === 'weekly' && task.dayOfWeek === i) ||
          (task.frequency === 'monthly' && task.day === currentDate.getDate())
        ) {
          tasks.push({
            id: crypto.randomUUID(),
            text: task.text,
            completed: false,
            date: currentDate,
            recurringTaskId: task.id
          });
        }
      });
    }

    setWeeklyTasks(tasks);
  };

  const addRecurringTask = (task: Omit<RecurringTask, 'id'>) => {
    setRecurringTasks(prev => [...prev, { ...task, id: crypto.randomUUID() }]);
  };

  const deleteRecurringTask = (taskId: string) => {
    setRecurringTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const toggleTaskCompletion = (taskId: string) => {
    setWeeklyTasks(prev =>
      prev.map(task =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">This Week's Tasks</h3>
        <div className="space-y-2">
          {weeklyTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleTaskCompletion(task.id)}
                  className={`flex items-center justify-center w-5 h-5 rounded border ${
                    task.completed
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {task.completed && <CheckSquare size={16} />}
                </button>
                <div>
                  <span className={`text-sm ${
                    task.completed
                      ? 'text-gray-500 dark:text-gray-400 line-through'
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {task.text}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {task.date.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <RecurringTaskList
        title="Recurring Social Media Tasks"
        tasks={recurringTasks}
        onAddTask={addRecurringTask}
        onDeleteTask={deleteRecurringTask}
      />
    </div>
  );
};

export default Planner;