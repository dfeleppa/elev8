import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import TaskList from '../../components/shared/TaskList';
import PlanningCalendar from '../../components/planning/PlanningCalendar';
import RecurringTaskList from '../../components/planning/RecurringTaskList';
import type { Task, RecurringTask } from '../../types/planning';

const Events: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', text: 'Plan summer event', completed: false },
    { id: '2', text: 'Order new merchandise', completed: true },
    { id: '3', text: 'Book venue for workshop', completed: false }
  ]);
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([
    {
      id: '1',
      text: 'Monthly Inventory Check',
      frequency: 'monthly',
      day: 1,
    },
    {
      id: '2',
      text: 'Team Training Session',
      frequency: 'weekly',
      dayOfWeek: 3, // Wednesday
    },
    {
      id: '3',
      text: 'Stock Level Review',
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
    }
  ]);

  const addTask = (text: string) => {
    setTasks(prev => [...prev, { id: crypto.randomUUID(), text, completed: false }]);
  };

  const toggleTask = (taskId: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const addRecurringTask = (task: Omit<RecurringTask, 'id'>) => {
    setRecurringTasks(prev => [...prev, { ...task, id: crypto.randomUUID() }]);
  };

  const deleteRecurringTask = (taskId: string) => {
    setRecurringTasks(prev => prev.filter(task => task.id !== taskId));
  };

  const handlePreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/planning"
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Events & Apparel Planning</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage events and apparel inventory</p>
        </div>
      </div>
      
      <PlanningCalendar
        currentDate={currentDate}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        recurringTasks={recurringTasks}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecurringTaskList
          title="Recurring Events & Inventory Tasks"
          tasks={recurringTasks}
          onAddTask={addRecurringTask}
          onDeleteTask={deleteRecurringTask}
        />
        
        <TaskList
          title="One-time Events & Inventory Tasks"
          tasks={tasks}
          onAddTask={addTask}
          onToggleTask={toggleTask}
          onDeleteTask={deleteTask}
        />
      </div>
    </div>
  );
};

export default Events;