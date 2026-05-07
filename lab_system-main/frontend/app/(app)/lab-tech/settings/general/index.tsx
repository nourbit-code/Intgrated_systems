import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { theme } from '@/constants/theme';

export default function GeneralSettingsPage() {
  const router = useRouter();

  return (
    <DashboardLayout title="General Settings">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleWrap}>
            <Text style={styles.sectionTitle}>General Settings</Text>
            <InfoHint text="This category is ready. We can add theme, language, and default workflow options here next." />
          </View>
          <Pressable style={styles.backButton} onPress={() => router.push('/lab-tech/settings' as Href)}>
            <Text style={styles.backText}>Back to Settings</Text>
          </Pressable>
        </View>
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  backText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
});
