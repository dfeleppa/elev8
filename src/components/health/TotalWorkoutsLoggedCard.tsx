import { Activity } from "lucide-react";
import { MetricCard } from "@/components/member-dashboard/PremiumDashboard";

type TotalWorkoutsLoggedCardProps = {
  totalWorkouts: number;
};

function formatCount(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.trunc(value)));
}

export default function TotalWorkoutsLoggedCard({ totalWorkouts }: TotalWorkoutsLoggedCardProps) {
  return (
    <MetricCard
      label="Total Workouts Logged"
      value={formatCount(totalWorkouts)}
      hint="All workout result entries saved for your account."
      tone="teal"
      icon={<Activity className="h-5 w-5" aria-hidden="true" />}
      className="fade-in"
    />
  );
}
