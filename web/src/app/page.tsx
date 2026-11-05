import { Suspense } from "react";
import { DashboardView } from "@/components/dashboard-view";
import { Skeleton } from "@/components/ui";
export default function Home() {
  return (
    <Suspense fallback={<Skeleton />}>
      <DashboardView view="overview" />
    </Suspense>
  );
}
