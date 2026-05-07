import { Image, Platform, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { ManagedUser, roleLabel } from '@/hooks/useAuth';

type UserProfileSummaryCardProps = {
  user: ManagedUser;
  title?: string;
};

function formatWorkingHours(start?: string, end?: string) {
  if (!start && !end) return 'Not assigned';
  if (!start) return `Until ${end}`;
  if (!end) return `${start} onward`;
  return `${start} - ${end}`;
}

function profileValue(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : 'Not provided';
}

export function UserProfileSummaryCard({ user, title = 'Profile Summary' }: UserProfileSummaryCardProps) {
  const profile = user.profile;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {profile.photoDataUrl ? (
        <View style={styles.photoWrap}>
          <Image
            source={{ uri: profile.photoDataUrl }}
            style={styles.photo}
            resizeMode="cover"
            testID="profile-photo"
            accessibilityLabel="Profile photo"
          />
        </View>
      ) : null}

      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{profileValue(user.name)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>User ID</Text>
          <Text style={styles.value}>{profileValue(user.id)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{roleLabel(user.role)}</Text>
        </View>

        <View style={styles.cell}>
          <Text style={styles.label}>Title</Text>
          <Text style={styles.value}>{profileValue(profile.title)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Department</Text>
          <Text style={styles.value}>{profileValue(profile.department)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Shift</Text>
          <Text style={styles.value}>{profileValue(profile.shift)}</Text>
        </View>

        <View style={styles.cell}>
          <Text style={styles.label}>Working Days</Text>
          <Text style={styles.value}>{profileValue(profile.workingDays)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Working Hours</Text>
          <Text style={styles.value}>{formatWorkingHours(profile.workingHoursStart, profile.workingHoursEnd)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{profileValue(profile.contactPhone)}</Text>
        </View>

        <View style={styles.cell}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profileValue(profile.contactEmail ?? user.email)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Emergency Contact</Text>
          <Text style={styles.value}>{profileValue(profile.emergencyContact)}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{profileValue(profile.address)}</Text>
        </View>
      </View>

      <View style={styles.notesWrap}>
        <Text style={styles.label}>Notes</Text>
        <Text style={styles.value}>{profileValue(profile.notes)}</Text>
      </View>

      {Platform.OS === 'web' ? <Text style={styles.readOnly}>Read only</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  photoWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  cell: {
    width: Platform.OS === 'web' ? '31.5%' : '100%',
    backgroundColor: '#FBFCFE',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 4,
  },
  label: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: theme.font.body,
    fontSize: 18,
    color: theme.colors.ink,
  },
  notesWrap: {
    backgroundColor: '#FBFCFE',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 4,
  },
  readOnly: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
});
