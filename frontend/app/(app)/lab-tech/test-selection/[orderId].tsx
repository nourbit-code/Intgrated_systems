import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { useOrders } from '@/hooks/useOrders';

type Sample = {
  id: string;
  specimenType?: string;
  tubeColor?: string;
  volume?: string;
  fastingHours?: string;
  collectionSite?: string;
  collectionMethod?: string;
  collectedAt?: string;
  tubes?: string;
  condition?: string;
  labSection?: string;
  storageTemp?: string;
};

const SAMPLES_KEY = 'lab_samples_by_order';
const TESTS_BY_SAMPLE_KEY = 'lab_tests_by_sample';

export default function TestSelection() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const router = useRouter();
  const { orders } = useOrders();
  const order = useMemo(
    () => orders.find((item) => item.id === params.orderId),
    [orders, params.orderId],
  );
  const orderId = order?.id ?? params.orderId ?? '-';
  const tests = useMemo(
    () => (order?.tests ?? []).filter((test) => test.sample !== 'Imaging'),
    [order?.tests],
  );

  const samples = useMemo<Sample[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(SAMPLES_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored) as Record<string, Sample[]>;
      return parsed[orderId] ?? [];
    } catch {
      return [];
    }
  }, [orderId]);

  const [selectedBySample, setSelectedBySample] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = window.localStorage.getItem(TESTS_BY_SAMPLE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored) as Record<string, string[]>;
      return parsed;
    } catch {
      return {};
    }
  });

  const toggleTest = (sampleId: string, testId: string) => {
    setSelectedBySample((prev) => {
      const current = prev[sampleId] ?? [];
      const next = current.includes(testId)
        ? current.filter((id) => id !== testId)
        : [...current, testId];
      return { ...prev, [sampleId]: next };
    });
  };

  const handleConfirm = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(TESTS_BY_SAMPLE_KEY);
        const parsed = stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
        const merged = { ...parsed, ...selectedBySample };
        window.localStorage.setItem(TESTS_BY_SAMPLE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
    router.push(`/lab-tech/results-multi/${orderId}` as Href);
  };

  return (
    <DashboardLayout title="Select Tests">
      <FormCard>
        <Text style={styles.sectionTitle}>Samples for Order {orderId}</Text>
        <Text style={styles.helperText}>Assign tests for each sample before proceeding.</Text>
      </FormCard>

      {samples.map((sample) => (
        <FormCard key={sample.id}>
          <View style={styles.sampleHeader}>
            <Text style={styles.sampleTitle}>Sample {sample.id}</Text>
            <Text style={styles.sampleMeta}>
              {sample.specimenType ?? '-'} | {sample.tubeColor ?? '-'} | {sample.volume ?? '-'} ml
            </Text>
          </View>
          <View style={styles.chipRow}>
            {tests.map((test) => {
              const active = (selectedBySample[sample.id] ?? []).includes(test.id);
              return (
                <Pressable
                  key={`${sample.id}-${test.id}`}
                  onPress={() => toggleTest(sample.id, test.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{test.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </FormCard>
      ))}

      <View style={styles.actions}>
        <PrimaryButton label="Confirm Tests" onPress={handleConfirm} disabled={samples.length === 0} />
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  helperText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
  sampleHeader: {
    gap: 4,
  },
  sampleTitle: {
    fontFamily: theme.font.heading,
    fontSize: 14,
    color: theme.colors.ink,
  },
  sampleMeta: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  chipRow: {
    marginTop: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  chipActive: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: '#99F6E4',
  },
  chipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  chipTextActive: {
    color: theme.colors.ink,
  },
  actions: {
    marginTop: theme.spacing.md,
  },
});
