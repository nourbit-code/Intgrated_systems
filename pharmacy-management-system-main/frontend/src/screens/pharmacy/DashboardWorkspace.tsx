import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActionCard } from '../../components/ActionCard';
import { Card } from '../../components/Card';
import { DataTable } from '../../components/DataTable';
import { InputField } from '../../components/InputField';
import { SecondaryButton } from '../../components/Buttons';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Section } from '../../components/Section';
import { StatCard } from '../../components/StatCard';

type DashboardWorkspaceProps = {
  avgPrepTime: number;
  filteredNotifications: any[];
  handleDispense: (row: any) => void;
  handleIncomingStatus: (row: any, status: string) => void;
  handleSimulateSync: () => void;
  inbox: any[];
  inboxFilter: string;
  inboxSearch: string;
  isQuickActionCollapsed: (key: string) => boolean;
  isTableCardCollapsed: (key: string) => boolean;
  lowStockAlerts: any[];
  markNotificationRead: (note: any) => void;
  onCloseNotificationDrawer: () => void;
  onInboxFilterChange: (value: string) => void;
  onInboxSearchChange: (value: string) => void;
  onSectionChange?: (section: string) => void;
  onSelectPatient: (patient: any) => void;
  onToggleNotificationDrawer: () => void;
  patients: any[];
  pendingRequests: any[];
  recentDispensedRows: any[];
  setShowNotificationDrawer: (value: boolean) => void;
  showDashboard: boolean;
  showNotificationDrawer: boolean;
  styles: any;
  summaryCards: any[];
  toast: (message: string, tone?: 'success' | 'info' | 'warning') => void;
  toggleQuickAction: (key: string) => void;
  toggleTableCard: (key: string) => void;
  topDispensed: string;
  unreadNotifications: number;
};

export function DashboardWorkspace({
  avgPrepTime,
  filteredNotifications,
  handleDispense,
  handleIncomingStatus,
  handleSimulateSync,
  inbox,
  inboxFilter,
  inboxSearch,
  isQuickActionCollapsed,
  isTableCardCollapsed,
  lowStockAlerts,
  markNotificationRead,
  onCloseNotificationDrawer,
  onInboxFilterChange,
  onInboxSearchChange,
  onSectionChange,
  onSelectPatient,
  onToggleNotificationDrawer,
  patients,
  pendingRequests,
  recentDispensedRows,
  setShowNotificationDrawer,
  showDashboard,
  showNotificationDrawer,
  styles,
  summaryCards,
  toast,
  toggleQuickAction,
  toggleTableCard,
  topDispensed,
  unreadNotifications,
}: DashboardWorkspaceProps) {
  return (
    <>
      <View style={styles.inboxFloatingWrap}>
        <TouchableOpacity
          style={styles.inboxFloatingButton}
          onPress={onToggleNotificationDrawer}
          accessibilityLabel="Open notifications"
        >
          <MaterialCommunityIcons name="bell-outline" size={24} color="#ffffff" />
          {unreadNotifications > 0 ? (
            <View style={styles.inboxFloatingBadge}>
              <Text style={styles.inboxFloatingBadgeText}>{unreadNotifications}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {showNotificationDrawer ? (
        <Card variant="soft" style={styles.notificationDrawer}>
          <View style={styles.notificationDrawerHeader}>
            <Text style={styles.formTitle}>Notifications</Text>
            <SecondaryButton label="Close" onPress={onCloseNotificationDrawer} />
          </View>
          <InputField
            label="Search"
            placeholder="Search message or reference"
            value={inboxSearch}
            onChangeText={onInboxSearchChange}
          />
          <View style={styles.filterRow}>
            <SegmentedControl options={['All', 'Unread', 'Alert']} value={inboxFilter} onChange={onInboxFilterChange} />
          </View>

          <ScrollView style={styles.drawerContent} showsVerticalScrollIndicator={true}>
            <Text style={styles.drawerSectionTitle}>Requests</Text>
            {pendingRequests.length ? (
              pendingRequests.slice(0, 8).map((item) => (
                <View key={item.id} style={styles.drawerRow}>
                  <View style={styles.drawerTextBlock}>
                    <Text style={styles.alertName}>{item.patient}</Text>
                    <Text style={styles.alertMeta}>{item.meds} - {item.status}</Text>
                  </View>
                  <SecondaryButton
                    label="Open"
                    onPress={() => {
                      if (onSectionChange) onSectionChange('Prep Queue');
                      setShowNotificationDrawer(false);
                    }}
                  />
                </View>
              ))
            ) : (
              <Text style={styles.noteMeta}>No pending requests.</Text>
            )}

            <Text style={styles.drawerSectionTitle}>Alerts and Updates</Text>
            {filteredNotifications.length ? (
              filteredNotifications.slice(0, 10).map((note) => (
                <View key={note.id} style={styles.drawerRow}>
                  <View style={styles.drawerTextBlock}>
                    <Text style={styles.alertName}>{note.message}</Text>
                    <Text style={styles.alertMeta}>{note.time} - {note.status}</Text>
                  </View>
                  <View style={styles.inlineActions}>
                    <SecondaryButton label="Read" onPress={() => markNotificationRead(note)} />
                    <SecondaryButton
                      label="Go"
                      onPress={() => {
                        markNotificationRead(note);
                        if (onSectionChange && note.page) onSectionChange(note.page);
                        setShowNotificationDrawer(false);
                      }}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noteMeta}>No alerts yet.</Text>
            )}
          </ScrollView>
        </Card>
      ) : null}

      {showDashboard ? (
        <View style={styles.dashboardHeader}>
          <View style={styles.dashboardHeaderText}>
            <Text style={styles.dashboardTitle}>Pharmacy Dashboard</Text>
          </View>
          <View style={styles.dashboardActions}>
            <SecondaryButton label="Sync Now" onPress={handleSimulateSync} />
            <SecondaryButton
              label="Open Invoices"
              onPress={() => {
                if (onSectionChange) onSectionChange('Invoices');
                toast('Opened invoices workspace.');
              }}
            />
          </View>
        </View>
      ) : null}

      {showDashboard ? (
        <View style={styles.row}>
          {summaryCards.map((item) => (
            <StatCard key={item.label} {...item} variant="alt" />
          ))}
        </View>
      ) : null}

      {showDashboard ? (
        <Section title="Incoming Prescriptions" action={<SecondaryButton label="Sync Now" onPress={handleSimulateSync} />}>
          <Card
            variant="white"
            title="Prescription Queue"
            collapsible
            isCollapsed={isTableCardCollapsed('prescription-queue')}
            onToggleCollapse={() => toggleTableCard('prescription-queue')}
          >
            <DataTable
              columns={[
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'doctor', label: 'Doctor' },
                { key: 'meds', label: 'Prescription', wide: true },
                { key: 'time', label: 'Time' },
                { key: 'status', label: 'Status' },
                {
                  key: 'action',
                  label: 'Action',
                  render: (row: any) => (
                    <View style={styles.inlineActions}>
                      <SecondaryButton
                        label="View"
                        onPress={() => {
                          const patientMatch = patients.find((p) => p.name === row.patient);
                          if (patientMatch) {
                            onSelectPatient(patientMatch);
                            if (onSectionChange) onSectionChange('Patients');
                            toast(`Opened profile for ${patientMatch.name}.`);
                          } else {
                            toast(`Patient record not found for ${row.patient}.`, 'warning');
                          }
                        }}
                      />
                      <SecondaryButton label="Preparing" onPress={() => handleIncomingStatus(row, 'Preparing')} />
                      <SecondaryButton label="Ready" onPress={() => handleIncomingStatus(row, 'Ready')} />
                      <SecondaryButton label="Dispense" onPress={() => handleDispense(row)} />
                    </View>
                  ),
                },
              ]}
              rows={inbox}
            />
          </Card>
        </Section>
      ) : null}

      {showDashboard ? (
        <Section title="Low Stock Alerts">
          <Card
            variant="white"
            title="Low Stock Table"
            collapsible
            isCollapsed={isTableCardCollapsed('low-stock-table')}
            onToggleCollapse={() => toggleTableCard('low-stock-table')}
          >
            <DataTable
              columns={[
                { key: 'name', label: 'Drug', wide: true },
                { key: 'stock', label: 'Current Stock' },
                { key: 'threshold', label: 'Minimum Level' },
              ]}
              rows={lowStockAlerts}
            />
          </Card>
        </Section>
      ) : null}

      {showDashboard ? (
        <Section title="Quick Actions">
          <View style={styles.row}>
            <ActionCard
              label="Add New Drug"
              hint="Inventory"
              isCollapsed={isQuickActionCollapsed('add-new-drug')}
              onToggleCollapse={() => toggleQuickAction('add-new-drug')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory opened for new drug entry.');
              }}
            />
            <ActionCard
              label="Update Stock"
              hint="Restock"
              isCollapsed={isQuickActionCollapsed('update-stock')}
              onToggleCollapse={() => toggleQuickAction('update-stock')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory opened for stock update.');
              }}
            />
            <ActionCard
              label="Search Medicine"
              hint="Inventory"
              isCollapsed={isQuickActionCollapsed('search-medicine')}
              onToggleCollapse={() => toggleQuickAction('search-medicine')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory search ready.');
              }}
            />
            <ActionCard
              label="Create Invoice"
              hint="Invoices"
              isCollapsed={isQuickActionCollapsed('create-invoice')}
              onToggleCollapse={() => toggleQuickAction('create-invoice')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Invoices');
                toast('Invoices workspace opened.');
              }}
            />
            <ActionCard
              label="View Inventory"
              hint="Snapshot"
              isCollapsed={isQuickActionCollapsed('view-inventory')}
              onToggleCollapse={() => toggleQuickAction('view-inventory')}
              onPress={() => {
                if (onSectionChange) onSectionChange('Inventory');
                toast('Inventory snapshot opened.');
              }}
            />
          </View>
        </Section>
      ) : null}

      {showDashboard ? (
        <Section title="Recent Activity">
          <Card variant="white" style={styles.sectionCard} title="Snapshot">
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Top dispensed today</Text>
              <Text style={styles.snapshotValue}>{topDispensed || 'No data yet'}</Text>
            </View>
            <View style={styles.snapshotRow}>
              <Text style={styles.snapshotLabel}>Average prep time</Text>
              <Text style={styles.snapshotValue}>{avgPrepTime} min</Text>
            </View>
          </Card>
          <Card
            variant="white"
            style={styles.sectionCard}
            title="Recent Dispensed"
            collapsible
            isCollapsed={isTableCardCollapsed('recent-dispensed')}
            onToggleCollapse={() => toggleTableCard('recent-dispensed')}
          >
            <DataTable
              columns={[
                { key: 'patient', label: 'Patient', wide: true },
                { key: 'drug', label: 'Drug', wide: true },
                { key: 'time', label: 'Time' },
              ]}
              rows={recentDispensedRows}
            />
          </Card>
        </Section>
      ) : null}
    </>
  );
}
