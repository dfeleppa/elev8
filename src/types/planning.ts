interface Task {
  id: string;
  text: string;
  completed: boolean;
}

interface RecurringTask {
  id: string;
  text: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  day?: number; // Day of month for monthly tasks
  dayOfWeek?: number; // 0-6 for weekly tasks
  lastCompleted?: Date;
}

export type { Task, RecurringTask };