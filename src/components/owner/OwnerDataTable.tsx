import type { ReactNode } from "react";

type OwnerDataTableProps = {
  minWidthClassName?: string;
  children: ReactNode;
};

export default function OwnerDataTable({ minWidthClassName = "min-w-[1180px]", children }: OwnerDataTableProps) {
  return (
    <div className="app-table-shell mt-6 overflow-x-auto">
      <table className={`app-table w-full border-collapse ${minWidthClassName}`}>{children}</table>
    </div>
  );
}
