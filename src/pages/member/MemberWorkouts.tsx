import React from 'react';
import { Dumbbell, Clock, CheckCircle, Play, Calendar } from 'lucide-react';

const MemberWorkouts: React.FC = () => {
  const workouts = [
    {
      id: 1,
      name: 'Upper Body Strength',
      duration: '45 mins',
      exercises: 8,
      difficulty: 'Intermediate',
      completed: false,
      type: 'Strength'
    },
    {
      id: 2,
      name: 'HIIT Cardio Blast',
      duration: '30 mins',
      exercises: 6,
      difficulty: 'Advanced',
      completed: true,
      type: 'Cardio'
    },
    {
      id: 3,
      name: 'Core & Flexibility',
      duration: '25 mins',
      exercises: 5,
      difficulty: 'Beginner',
      completed: false,
      type: 'Core'
    }
  ];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'Intermediate': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'Advanced': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Daily Workouts
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Your personalized workout plan for today.
        </p>
      </div>

      <div className="grid gap-6">
        {workouts.map((workout) => (
          <div key={workout.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Dumbbell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {workout.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {workout.type} Workout
                  </p>
                </div>
              </div>
              {workout.completed ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{workout.duration}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Dumbbell className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">{workout.exercises} exercises</span>
              </div>
              <div className="col-span-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(workout.difficulty)}`}>
                  {workout.difficulty}
                </span>
              </div>
            </div>

            {workout.completed && (
              <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Completed</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-3">
          <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Weekly Progress
          </h3>
        </div>
        <p className="text-blue-800 dark:text-blue-200 mb-2">
          You've completed 4 out of 6 planned workouts this week.
        </p>
        <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
          <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full" style={{ width: '67%' }}></div>
        </div>
      </div>
    </div>
  );
};

export default MemberWorkouts;
