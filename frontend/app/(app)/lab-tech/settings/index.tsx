import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { theme } from '@/constants/theme';

type SettingsCategory = {
  title: string;
  description: string;
  path: string;
};

const settingsCategories: SettingsCategory[] = [
  {
    title: 'Inventory Settings',
    description: 'Manage categories, units, and suppliers for inventory dropdowns.',
    path: '/lab-tech/inventory/settings',
  },
  {
    title: 'Tests & Scans Settings',
    description: 'Add and manage tests and scans for the create order test catalog.',
    path: '/lab-tech/settings/tests-scans',
  },
  {
    title: 'General Settings',
    description: 'Manage application preferences for the lab team workspace.',
    path: '/lab-tech/settings/general',
  },
];

export default function LabTechSettingsPage() {
  const router = useRouter();

  return (
    <DashboardLayout title="Settings">
      <FormCard>
        <View style={styles.titleWrap}>
          <Text style={styles.sectionTitle}>Settings Categories</Text>
          <InfoHint text="Choose a settings section to configure." />
        </View>

        <View style={styles.categoriesWrap}>
          {settingsCategories.map((category) => (
            <Pressable
              key={category.title}
              onPress={() => router.push(category.path as Href)}
              style={({ hovered }) => [styles.categoryCard, hovered && styles.categoryCardHover]}
            >
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </Pressable>
          ))}
        </View>
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
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
  categoriesWrap: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  categoryCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  categoryCardHover: {
    backgroundColor: theme.colors.surface,
  },
  categoryTitle: {
    fontFamily: theme.font.heading,
    fontSize: 15,
    color: theme.colors.ink,
  },
  categoryDescription: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.slate,
  },
});
