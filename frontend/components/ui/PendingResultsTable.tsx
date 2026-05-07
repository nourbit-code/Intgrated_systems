import { DataTable } from './DataTable';
import { StatusBadge } from './StatusBadge';

export function PendingResultsTable() {
  return (
    <DataTable
      title="Samples Waiting Results"
      columns={['Patient', 'Test', 'Due', 'Status']}
      rows={[
        ['Hani Mostafa', 'CBC', '14:00', <StatusBadge status="in-progress" />],
        ['Dina Adel', 'MRI', '15:30', <StatusBadge status="samples-waiting" />],
      ]}
    />
  );
}
