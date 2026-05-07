import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { SearchInput } from '@/components/ui/SearchInput';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { usePatients, Patient } from '@/hooks/usePatients';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';

const accent = theme.colors.accent;
const accentSoft = theme.colors.accentSoft;
const accentDeep = '#0B5A45';

export default function PatientsHistory() {
  const router = useRouter();
  const { role } = useAuth();
  const { patients } = usePatients();
  const { orders } = useOrders();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Patient | null>(null);

  const latestServiceByPatientId = useMemo(() => {
    const map = new Map<string, { lastTest: string; lastVisitDate: string }>();
    const sorted = [...orders].sort((a, b) => b.date.localeCompare(a.date));
    for (const order of sorted) {
      if (map.has(order.patientId)) continue;
      const names = order.tests.map((test) => test.name).filter(Boolean);
      map.set(order.patientId, {
        lastTest: names.length > 0 ? names.join(', ') : 'N/A',
        lastVisitDate: order.date || 'N/A',
      });
    }
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter((p) => {
      const haystack = `${p.name} ${p.id} ${p.phone}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [patients, search]);

  useEffect(() => {
    if (!selected && filtered.length > 0) {
      setSelected(filtered[0]);
    }
    if (selected && !filtered.find((p) => p.id === selected.id)) {
      setSelected(filtered[0] ?? null);
    }
  }, [filtered, selected]);

  return (
    <DashboardLayout title="Patients Directory">
      <View style={styles.layout}>
        <View style={styles.listColumn}>
          <View style={styles.searchRow}>
            <SearchInput placeholder="Search patients..." value={search} onChangeText={setSearch} />
          </View>
          <Text style={styles.countText}>{filtered.length} patients found</Text>
          <View style={styles.list}>
            {filtered.map((patient) => {
              const isSelected = selected?.id === patient.id;
              const latest = latestServiceByPatientId.get(patient.id);
              const displayLastTest = latest?.lastTest ?? patient.lastTest ?? 'N/A';
              const displayLastVisitDate = latest?.lastVisitDate ?? patient.lastVisitDate ?? 'N/A';
              return (
                <Pressable
                  key={patient.id}
                  onPress={() => setSelected(patient)}
                  style={({ hovered }) => [
                    styles.patientCard,
                    hovered && styles.patientCardHover,
                    isSelected && styles.patientCardActive,
                  ]}
                >
                  <View style={styles.patientRow}>
                    <View style={styles.patientMeta}>
                      <Text style={styles.patientName}>{patient.name}</Text>
                      <Text style={styles.patientSub}>Last Service: {displayLastTest}</Text>
                      <Text style={styles.patientSub}>Last Visit: {displayLastVisitDate}</Text>
                    </View>
                    <View style={styles.cardActions}>
                      {role === 'lab-tech' ? (
                        <Pressable
                          style={[styles.actionButton, styles.actionButtonGhost]}
                          onPress={() =>
                            router.push({
                              pathname: '/receptionist/create-order',
                              params: { patientId: patient.id },
                            })
                          }
                        >
                          <Text style={[styles.actionLabel, styles.actionLabelGhost]}>Create Order</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[styles.actionButton, styles.actionButtonSolid]}
                        onPress={() => router.push(`/patients/${patient.id}`)}
                      >
                        <Text style={styles.actionLabel}>Details</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card style={styles.detailCard}>
          {selected ? (
            (() => {
              const latest = latestServiceByPatientId.get(selected.id);
              const displayLastTest = latest?.lastTest ?? selected.lastTest ?? 'N/A';
              const displayLastVisitDate = latest?.lastVisitDate ?? selected.lastVisitDate ?? 'N/A';
              return (
            <View style={styles.detailContent}>
              <View style={styles.detailHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{selected.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.detailHeaderText}>
                  <Text style={styles.detailTitle}>Patient Details</Text>
                  <Text style={styles.detailName}>{selected.name}</Text>
                  <View style={styles.genderChip}>
                    <Text style={styles.genderText}>{selected.gender}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.detailDivider} />

              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Age</Text>
                  <Text style={styles.detailValue}>{selected.age} years</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{selected.phone}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Last Service</Text>
                  <Text style={styles.detailValue}>{displayLastTest}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Last Visit</Text>
                  <Text style={styles.detailValue}>{displayLastVisitDate}</Text>
                </View>
              </View>

              <View style={styles.quickActions}>
                <Pressable style={styles.secondaryButton} onPress={() => router.push(`/patients/${selected.id}`)}>
                  <Text style={styles.secondaryLabel}>View Full Profile</Text>
                </Pressable>
                <PrimaryButton
                  label="Create Order"
                  onPress={() => router.push({ pathname: '/receptionist/create-order', params: { patientId: selected.id } })}
                />
              </View>
            </View>
              );
            })()
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Select a patient</Text>
              <Text style={styles.emptyText}>Choose a patient to preview their profile summary.</Text>
            </View>
          )}
        </Card>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    width: '100%',
    marginBottom: 4,
  },
  layout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    alignItems: 'flex-start',
  },
  listColumn: {
    flex: 3,
    minWidth: 320,
    gap: 10,
  },
  countText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
    marginBottom: 2,
  },
  list: {
    gap: 12,
  },
  patientCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  patientCardHover: {
    borderColor: '#CDE9E0',
  },
  patientCardActive: {
    backgroundColor: accentSoft,
    borderColor: accent,
  },
  patientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  patientMeta: {
    gap: 4,
  },
  patientName: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  patientSub: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  cardActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    alignSelf: 'center',
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  actionButtonGhost: {
    backgroundColor: '#FFFFFF',
    borderColor: accent,
  },
  actionButtonSolid: {
    backgroundColor: accent,
    borderColor: accent,
  },
  actionLabel: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  actionLabelGhost: {
    color: accent,
  },
  detailCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 340,
    alignSelf: 'flex-start',
    marginTop: 0,
  },
  detailContent: {
    gap: theme.spacing.md,
  },
  detailHeader: {
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: accentSoft,
    borderWidth: 2,
    borderColor: accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: theme.font.heading,
    fontSize: 25,
    color: accent,
  },
  detailHeaderText: {
    alignItems: 'center',
    gap: 4,
  },
  detailDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.6,
    marginTop: 2,
  },
  detailTitle: {
    fontFamily: theme.font.body,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  detailName: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  genderChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#E0F2F1',
  },
  genderText: {
    fontFamily: theme.font.body,
    fontSize: 11,
    color: accentDeep,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  detailGrid: {
    gap: 10,
  },
  detailItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  detailLabel: {
    fontFamily: theme.font.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: theme.colors.slate,
  },
  detailValue: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  quickActions: {
    gap: 10,
    paddingTop: 2,
  },
  secondaryButton: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: accent,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: accent,
  },
  emptyState: {
    gap: theme.spacing.xs,
  },
  emptyTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  emptyText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
