import { DataTable } from './DataTable';
import { StatusBadge } from './StatusBadge';

export function AppointmentsTable() {
  return (
    <DataTable
      title="Upcoming Appointments"
      columns={['Patient', 'Type', 'Time', 'Status']}
      rows={[
        ['Sara Ali', 'Lab Test', '10:30', <StatusBadge status="samples-waiting" />],
        ['Mina Khaled', 'Scan', '11:10', <StatusBadge status="in-progress" />],
      ]}
    />
  );
}
