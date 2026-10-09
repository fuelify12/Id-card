import { DashboardNavigation } from "@/components/dashboard/dashboard-navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><DashboardNavigation>{children}</DashboardNavigation></div>;
}
