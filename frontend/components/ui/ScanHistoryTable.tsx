import { DataTable } from './DataTable';
import { StatusBadge } from './StatusBadge';

export function ScanHistoryTable() {
  return (
    <DataTable
      title="Scan History"
      columns={['Scan', 'Date', 'Status']}
      rows={[
        ['MRI', 'Feb 22', <StatusBadge status="completed" />],
        ['X-ray', 'Feb 10', <StatusBadge status="completed" />],
      ]}
    />
  );
}
