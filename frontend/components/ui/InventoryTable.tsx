import { DataTable } from './DataTable';
import { StockLevelBadge } from './StockLevelBadge';

export function InventoryTable() {
  return (
    <DataTable
      title="Inventory"
      columns={['Item', 'Stock', 'Level']}
      rows={[
        ['Test Kits', '42', <StockLevelBadge level="good" />],
        ['Reagents', '12', <StockLevelBadge level="medium" />],
        ['Gloves', '6', <StockLevelBadge level="low" />],
      ]}
    />
  );
}
