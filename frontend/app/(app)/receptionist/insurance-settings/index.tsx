import { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, TextInput } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { theme } from '@/constants/theme';
import { useInsuranceSettings } from '@/hooks/useInsuranceSettings';

function parsePercent(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

export default function InsuranceSettings() {
  const { providers, discounts, addProvider, setDiscount, aliases, setAlias, removeAlias } = useInsuranceSettings();
  const [newProvider, setNewProvider] = useState('');
  const [aliasFrom, setAliasFrom] = useState('');
  const [aliasTo, setAliasTo] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'discount'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleAddProvider = () => {
    const trimmed = newProvider.trim();
    if (!trimmed) return;
    addProvider(trimmed);
    setNewProvider('');
  };

  const sortedProviders = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...providers].sort((a, b) => {
      if (sortKey === 'discount') {
        const discountA = discounts[a] ?? 0;
        const discountB = discounts[b] ?? 0;
        return (discountA - discountB) * dir;
      }
      return a.localeCompare(b) * dir;
    });
  }, [providers, discounts, sortKey, sortDir]);

  const aliasRows = useMemo(
    () => Object.entries(aliases).sort((a, b) => a[0].localeCompare(b[0])),
    [aliases]
  );

  return (
    <DashboardLayout title="Insurance Settings">
      <View style={styles.grid}>
        <FormCard>
          <Text style={styles.sectionTitle}>Add Insurance Company</Text>
          <View style={styles.addRow}>
            <TextInput
              placeholder="Company name"
              placeholderTextColor={theme.colors.slate}
              value={newProvider}
              onChangeText={setNewProvider}
              style={styles.addInput}
            />
            <Pressable onPress={handleAddProvider} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        </FormCard>

        <FormCard>
          <Text style={styles.sectionTitle}>Insurance Name Aliases</Text>
          <View style={styles.addRow}>
            <TextInput
              placeholder="Incoming name (e.g. AXA Egypt)"
              placeholderTextColor={theme.colors.slate}
              value={aliasFrom}
              onChangeText={setAliasFrom}
              style={styles.addInput}
            />
            <TextInput
              placeholder="Canonical name (e.g. AXA)"
              placeholderTextColor={theme.colors.slate}
              value={aliasTo}
              onChangeText={setAliasTo}
              style={styles.addInput}
            />
            <Pressable
              onPress={() => {
                if (!aliasFrom.trim() || !aliasTo.trim()) return;
                setAlias(aliasFrom, aliasTo);
                setAliasFrom('');
                setAliasTo('');
              }}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>Save Alias</Text>
            </Pressable>
          </View>
          <View style={styles.list}>
            {aliasRows.map(([from, to]) => (
              <View key={from} style={styles.row}>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{from}</Text>
                  <Text style={styles.providerHint}>maps to {to}</Text>
                </View>
                <Pressable onPress={() => removeAlias(from)} style={styles.deleteButton}>
                  <Text style={styles.deleteButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </FormCard>

        <FormCard>
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>Company Discounts</Text>
            <View style={styles.sortRow}>
              <Pressable
                onPress={() => {
                  if (sortKey === 'name') {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortKey('name');
                    setSortDir('asc');
                  }
                }}
                style={[styles.sortChip, sortKey === 'name' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, sortKey === 'name' && styles.sortChipTextActive]}>
                  A-Z {sortKey === 'name' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (sortKey === 'discount') {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortKey('discount');
                    setSortDir('desc');
                  }
                }}
                style={[styles.sortChip, sortKey === 'discount' && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, sortKey === 'discount' && styles.sortChipTextActive]}>
                  Rate {sortKey === 'discount' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.list}>
            {sortedProviders.map((provider) => {
              const value = discounts[provider] ?? 0;
              return (
                <View key={provider} style={styles.row}>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{provider}</Text>
                    <Text style={styles.providerHint}>Discount %</Text>
                  </View>
                  <TextInput
                    value={String(value)}
                    onChangeText={(text) => setDiscount(provider, parsePercent(text))}
                    style={styles.percentInput}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>
        </FormCard>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: theme.spacing.lg,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  list: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sortChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  sortChipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  sortChipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  sortChipTextActive: {
    color: theme.colors.ink,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  providerInfo: {
    gap: 4,
  },
  providerName: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  providerHint: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  percentInput: {
    minWidth: 80,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    backgroundColor: theme.colors.card,
    textAlign: 'center',
  },
  addRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    backgroundColor: theme.colors.card,
  },
  addButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
  },
  addButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#F8FAFC',
  },
  deleteButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteButtonText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
});
