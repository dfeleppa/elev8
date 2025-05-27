import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RecurringTask } from '../../types/planning';

interface CalendarProps {
  currentDate: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  recurringTasks: RecurringTask[];
}

const PlanningCalendar: React.FC<CalendarProps> = ({
  currentDate,
  onPreviousMonth,
  onNextMonth,
  recurringTasks,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getTasksForDate = (date: Date): RecurringTask[] => {
    return recurringTasks.filter(task => {
      if (task.frequency === 'daily') return true;
      if (task.frequency === 'weekly' && task.dayOfWeek === date.getDay()) return true;
      if (task.frequency === 'monthly' && task.day === date.getDate()) return true;
      return false;
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onPreviousMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onNextMonth}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
            {day}
          </div>
        ))}

        {Array.from({ length: monthStart.getDay() }).map((_, index) => (
          <div key={`empty-start-${index}`} className="h-24" />
        ))}

        {daysInMonth.map(day => {
          const tasksForDay = getTasksForDate(day);
          return (
            <div
              key={day.toISOString()}
              className={`h-24 border border-gray-200 dark:border-gray-700 p-2 ${
                isToday(day) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <span className={`text-sm font-medium ${
                isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {tasksForDay.map(task => (
                  <div
                    key={task.id}
                    className="text-xs px-1 py-0.5 rounded bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 truncate"
                  >
                    {task.text}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {Array.from({ length: (7 - ((monthStart.getDay() + daysInMonth.length) % 7)) % 7 }).map((_, index) => (
          <div key={`empty-end-${index}`} className="h-24" />
        ))}
      </div>
    </div>
  );
};

export default PlanningCalendar;