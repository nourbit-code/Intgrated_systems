import { PropsWithChildren, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';

import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '../ui/PageHeader';

type DashboardLayoutProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  headerAction?: ReactNode;
  fullWidth?: boolean;
  showBackButton?: boolean;
}>;

export function DashboardLayout({
  title,
  subtitle,
  headerAction,
  fullWidth = false,
  showBackButton = true,
  children,
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { role } = useAuth();
  const homePath = role === 'lab-tech' ? '/lab-tech' : '/receptionist';

  const resolvedHeaderAction = (
    <View style={styles.headerActionsRow}>
      {showBackButton ? (
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (pathname !== homePath) {
              router.replace(homePath);
            }
          }}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      ) : null}
      {headerAction}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.container, fullWidth && styles.containerFull]} style={styles.scroll}>
        <PageHeader title={title} subtitle={subtitle} action={resolvedHeaderAction} />
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    width: '100%',
    maxWidth: 1200,
    alignSelf: 'center',
  },
  containerFull: {
    maxWidth: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 0,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  content: {
    gap: theme.spacing.lg,
  },
  headerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  backButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  backButtonText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: theme.colors.ink,
  },
});
