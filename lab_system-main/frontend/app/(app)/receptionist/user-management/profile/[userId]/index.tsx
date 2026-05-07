import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileUpload } from '@/components/ui/FileUpload';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { Role, roleLabel, useAuth, UserProfile } from '@/hooks/useAuth';

const shiftOptions = ['Morning', 'Evening', 'Night', 'Custom'] as const;

type EditableProfileFields = Pick<
  UserProfile,
  | 'title'
  | 'department'
  | 'shift'
  | 'workingDays'
  | 'workingHoursStart'
  | 'workingHoursEnd'
  | 'contactPhone'
  | 'contactEmail'
  | 'emergencyContact'
  | 'address'
  | 'notes'
  | 'photoDataUrl'
>;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Invalid file data.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export default function UserProfileEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const { users, saveUserProfileDetails } = useAuth();

  const targetUser = useMemo(() => users.find((user) => user.id === userId), [users, userId]);

  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('receptionist');
  const [profile, setProfile] = useState<EditableProfileFields>({
    title: '',
    department: '',
    shift: 'Morning',
    workingDays: '',
    workingHoursStart: '',
    workingHoursEnd: '',
    contactPhone: '',
    contactEmail: '',
    emergencyContact: '',
    address: '',
    notes: '',
    photoDataUrl: undefined,
  });
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (!targetUser) return;
    setName(targetUser.name);
    setRole(targetUser.role);
    setProfile({
      title: targetUser.profile.title,
      department: targetUser.profile.department,
      shift: targetUser.profile.shift,
      workingDays: targetUser.profile.workingDays,
      workingHoursStart: targetUser.profile.workingHoursStart,
      workingHoursEnd: targetUser.profile.workingHoursEnd,
      contactPhone: targetUser.profile.contactPhone,
      contactEmail: targetUser.profile.contactEmail ?? targetUser.email,
      emergencyContact: targetUser.profile.emergencyContact ?? '',
      address: targetUser.profile.address ?? '',
      notes: targetUser.profile.notes ?? '',
      photoDataUrl: targetUser.profile.photoDataUrl,
    });
    setSavedMessage('');
  }, [targetUser]);

  const cycleShift = () => {
    const currentIndex = shiftOptions.indexOf(profile.shift as (typeof shiftOptions)[number]);
    if (currentIndex === -1) {
      setProfile((prev) => ({ ...prev, shift: shiftOptions[0] }));
      return;
    }
    const nextIndex = (currentIndex + 1) % shiftOptions.length;
    setProfile((prev) => ({ ...prev, shift: shiftOptions[nextIndex] }));
  };

  const saveProfile = () => {
    if (!targetUser) {
      setError('User not found.');
      return;
    }

    const result = saveUserProfileDetails(targetUser.id, {
      name,
      role,
      profile,
    });
    if (!result.ok) {
      setError(result.error);
      setSavedMessage('');
      return;
    }

    setError('');
    setSavedMessage('Profile saved successfully.');
    Alert.alert('Saved', 'User profile updated successfully.');
  };

  if (!targetUser) {
    return (
      <DashboardLayout title="User Profile">
        <FormCard>
          <Text style={styles.missing}>User was not found.</Text>
          <View style={styles.actions}>
            <Pressable style={styles.backButton} onPress={() => router.push('/receptionist/user-management' as Href)}>
              <Text style={styles.backText}>Back to User Management</Text>
            </Pressable>
          </View>
        </FormCard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Profile">
      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <Pressable style={styles.backButton} onPress={() => router.push('/receptionist/user-management' as Href)}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        {savedMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{savedMessage}</Text>
          </View>
        ) : null}

        {profile.photoDataUrl ? (
          <View style={styles.photoSection}>
            <Image source={{ uri: profile.photoDataUrl }} style={styles.photo} resizeMode="cover" />
            <Pressable
              style={styles.removePhotoButton}
              onPress={() => setProfile((prev) => ({ ...prev, photoDataUrl: undefined }))}
            >
              <Text style={styles.removePhotoText}>Remove Photo</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.formGrid}>
          <View style={styles.formCell}>
            <TextInputField label="Name *" value={name} onChangeText={setName} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="User ID" value={targetUser.id} editable={false} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="Role" value={roleLabel(role)} editable={false} />
          </View>

          <View style={styles.formCell}>
            <TextInputField
              label="Job Title"
              value={profile.title}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, title: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Department"
              value={profile.department}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, department: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <SelectField label="Shift" value={profile.shift} onPress={cycleShift} />
          </View>

          <View style={styles.formCell}>
            <TextInputField
              label="Working Days"
              value={profile.workingDays}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, workingDays: value }))}
              placeholder="Sunday - Thursday"
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Working Hours Start"
              value={profile.workingHoursStart}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, workingHoursStart: value }))}
              placeholder="08:00"
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Working Hours End"
              value={profile.workingHoursEnd}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, workingHoursEnd: value }))}
              placeholder="16:00"
            />
          </View>

          <View style={styles.formCell}>
            <TextInputField
              label="Phone"
              value={profile.contactPhone}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, contactPhone: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Email"
              value={profile.contactEmail ?? ''}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, contactEmail: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Emergency Contact"
              value={profile.emergencyContact ?? ''}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, emergencyContact: value }))}
            />
          </View>

          <View style={styles.formCell}>
            <TextInputField
              label="Address"
              value={profile.address ?? ''}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, address: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="Notes"
              value={profile.notes ?? ''}
              onChangeText={(value) => setProfile((prev) => ({ ...prev, notes: value }))}
            />
          </View>
          <View style={styles.formCell}>
            <FileUpload
              label="User Photo"
              onFileSelected={async (file) => {
                if (!file) return;
                try {
                  const dataUrl = await fileToDataUrl(file);
                  setProfile((prev) => ({ ...prev, photoDataUrl: dataUrl }));
                  setError('');
                } catch {
                  setError('Could not read the selected image file.');
                }
              }}
            />
          </View>
        </View>

        {Platform.OS !== 'web' ? <Text style={styles.note}>Photo upload is available on web.</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton label="Save Profile" onPress={saveProfile} />
        </View>
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  formGrid: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  formCell: {
    width: Platform.OS === 'web' ? '31.5%' : '100%',
  },
  actions: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  errorText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
  },
  successBanner: {
    marginTop: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#ECFDF3',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  successBannerText: {
    fontFamily: theme.font.body,
    fontSize: 13,
    color: '#166534',
  },
  missing: {
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.ink,
  },
  note: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  photoSection: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  removePhotoButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  removePhotoText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
});
