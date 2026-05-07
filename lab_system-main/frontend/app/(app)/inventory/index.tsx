import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdjustStockModal } from '@/components/ui/AdjustStockModal';
import { InventoryTable } from '@/components/ui/InventoryTable';

export default function InventoryScreen() {
  return (
    <DashboardLayout title="Inventory" subtitle="Supplies and stock">
      <InventoryTable />
      <AdjustStockModal visible={false} />
    </DashboardLayout>
  );
}
