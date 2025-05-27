import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task, RecurringTask } from './types/planning';
import PlanningCalendar from '../components/planning/PlanningCalendar';

interface TaskListProps {
  title: string;
  tasks: Task[];
  path: string;
}

const TaskList: React.FC<TaskListProps> = ({ title, tasks, path }) => {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(path)}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all duration-200"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h3>
      
      <div className="space-y-2">
        {tasks.slice(0, 3).map((task) => (
          <div
            key={task.id}
            className="flex items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
          >
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-5 h-5 rounded border ${
                task.completed
                  ? 'bg-primary-600 border-primary-600'
                  : 'border-gray-300 dark:border-gray-600'
              }`}>
                {task.completed && '✓'}
              </div>
              <span className={`text-sm ${
                task.completed
                  ? 'text-gray-500 dark:text-gray-400 line-through'
                  : 'text-gray-900 dark:text-white'
              }`}>
                {task.text}
              </span>
            </div>
          </div>
        ))}
        {tasks.length > 3 && (
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            +{tasks.length - 3} more tasks
          </div>
        )}
      </div>
    </div>
  );
};

const Planning: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Combined recurring tasks from all planning pages
  const recurringTasks: RecurringTask[] = [
    // Marketing tasks
    {
      id: 'mkt-1',
      text: 'Weekly Marketing Meeting',
      frequency: 'weekly',
      dayOfWeek: 1,
    },
    {
      id: 'mkt-2',
      text: 'Monthly Performance Review',
      frequency: 'monthly',
      day: 1,
    },
    {
      id: 'mkt-3',
      text: 'Update Social Media',
      frequency: 'daily',
    },
    // Social Media tasks
    {
      id: 'sm-1',
      text: 'Post Instagram Story',
      frequency: 'daily',
    },
    {
      id: 'sm-2',
      text: 'Schedule Content',
      frequency: 'weekly',
      dayOfWeek: 5,
    },
    {
      id: 'sm-3',
      text: 'Analytics Review',
      frequency: 'monthly',
      day: 1,
    },
    // Events tasks
    {
      id: 'evt-1',
      text: 'Inventory Check',
      frequency: 'monthly',
      day: 1,
    },
    {
      id: 'evt-2',
      text: 'Team Training',
      frequency: 'weekly',
      dayOfWeek: 3,
    },
    {
      id: 'evt-3',
      text: 'Stock Review',
      frequency: 'weekly',
      dayOfWeek: 1,
    },
    // Retention tasks
    {
      id: 'ret-1',
      text: 'Member Survey',
      frequency: 'monthly',
      day: 15,
    },
    {
      id: 'ret-2',
      text: 'Churn Analysis',
      frequency: 'weekly',
      dayOfWeek: 1,
    },
    {
      id: 'ret-3',
      text: 'Inactive Members',
      frequency: 'weekly',
      dayOfWeek: 3,
    },
  ];

  const lists = {
    marketing: [
      { id: '1', text: 'Create Q2 marketing plan', completed: false },
      { id: '2', text: 'Review campaign metrics', completed: true },
      { id: '3', text: 'Update brand guidelines', completed: false },
      { id: '4', text: 'Plan social media content', completed: false }
    ],
    socialMedia: [
      { id: '1', text: 'Schedule weekly posts', completed: true },
      { id: '2', text: 'Engage with followers', completed: false },
      { id: '3', text: 'Analyze engagement metrics', completed: false }
    ],
    events: [
      { id: '1', text: 'Plan summer event', completed: false },
      { id: '2', text: 'Order new merchandise', completed: true },
      { id: '3', text: 'Book venue for workshop', completed: false }
    ],
    retention: [
      { id: '1', text: 'Review churn metrics', completed: true },
      { id: '2', text: 'Plan retention campaign', completed: false },
      { id: '3', text: 'Set up feedback surveys', completed: false }
    ]
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Planning</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your tasks and planning activities</p>
      </div>

      <PlanningCalendar
        currentDate={currentDate}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        recurringTasks={recurringTasks}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TaskList
          title="Marketing"
          tasks={lists.marketing}
          path="/planning/marketing"
        />
        <TaskList
          title="Social Media"
          tasks={lists.socialMedia}
          path="/planning/social-media"
        />
        <TaskList
          title="Events and Apparel"
          tasks={lists.events}
          path="/planning/events"
        />
        <TaskList
          title="Retention"
          tasks={lists.retention}
          path="/planning/retention"
        />
      </div>
    </div>
  );
};

export default Planning;