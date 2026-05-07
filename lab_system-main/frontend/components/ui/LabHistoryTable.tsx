import { DataTable } from './DataTable';
import { StatusBadge } from './StatusBadge';

export function LabHistoryTable() {
  return (
    <DataTable
      title="Lab History"
      columns={['Test', 'Date', 'Status']}
      rows={[
        ['CBC', 'Mar 09', <StatusBadge status="completed" />],
        ['Glucose', 'Mar 03', <StatusBadge status="completed" />],
      ]}
    />
  );
}
