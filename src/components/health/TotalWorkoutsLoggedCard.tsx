import { Micro, Panel, Stat } from "@/components/ui";

type TotalWorkoutsLoggedCardProps = {
  totalWorkouts: number;
};

function formatCount(value: number) {
  return new Intl.NumberFormat().format(Math.max(0, Math.trunc(value)));
}

export default function TotalWorkoutsLoggedCard({ totalWorkouts }: TotalWorkoutsLoggedCardProps) {
  return (
    <Panel padding="lg" className="fade-in">
      <Micro as="p">Total Workouts Logged</Micro>
      <Stat
        label=""
        value={formatCount(totalWorkouts)}
        size="xl"
        hint="All workout result entries saved for your account."
        className="mt-2"
      />
    </Panel>
  );
}
