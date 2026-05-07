import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { ReportCard } from '@/components/ui/ReportCard';
import { ReportsGrid } from '@/components/ui/ReportsGrid';

export default function ReportsIndex() {
  return (
    <DashboardLayout title="Reports" subtitle="Analytics and performance">
      <ReportsGrid>
        <ReportCard title="Daily Tests" description="Volume by department" />
        <ReportCard title="Revenue" description="Weekly cashflow" />
        <ReportCard title="Turnaround" description="Average lab times" />
      </ReportsGrid>
    </DashboardLayout>
  );
}
