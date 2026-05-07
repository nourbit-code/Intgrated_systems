import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { DataTable } from '@/components/ui/DataTable';
import { FormCard } from '@/components/ui/FormCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { TextInputField } from '@/components/ui/TextInputField';
import { theme } from '@/constants/theme';
import { Role, useAuth } from '@/hooks/useAuth';

const roleOptions: Role[] = ['receptionist', 'lab-tech'];
const statusOptions = ['Active', 'Inactive'] as const;

function roleLabel(role: Role) {
  return role === 'lab-tech' ? 'Lab Technician' : 'Receptionist';
}

export default function UserManagementScreen() {
  const router = useRouter();
  const {
    users,
    currentUser,
    createUser,
    updateUser,
    deleteUser,
    verifyUserManagementAccess,
    changeUserManagementPassword,
  } = useAuth();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('receptionist');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('Active');
  const [error, setError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [currentMgmtPassword, setCurrentMgmtPassword] = useState('');
  const [nextMgmtPassword, setNextMgmtPassword] = useState('');

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setEmail('');
    setPassword('');
    setRole('receptionist');
    setStatus('Active');
    setError('');
  };

  const cycleRole = () => {
    const currentIndex = roleOptions.indexOf(role);
    const nextIndex = (currentIndex + 1) % roleOptions.length;
    setRole(roleOptions[nextIndex]);
  };

  const cycleStatus = () => {
    setStatus((prev) => (prev === 'Active' ? 'Inactive' : 'Active'));
  };

  const handleSave = () => {
    if (editingId) {
      const result = updateUser(editingId, {
        name,
        email,
        password,
        role,
        active: status === 'Active',
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetForm();
      Alert.alert('Updated', 'User updated successfully.');
      return;
    }

    const result = createUser({
      name,
      email,
      password,
      role,
      active: status === 'Active',
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetForm();
    Alert.alert('Saved', 'User created successfully.');
  };

  const unlockPage = () => {
    if (!verifyUserManagementAccess(accessPassword)) {
      setPasswordError('Invalid management password.');
      return;
    }
    setPasswordError('');
    setIsUnlocked(true);
  };

  const updateManagementPassword = () => {
    const result = changeUserManagementPassword(currentMgmtPassword, nextMgmtPassword);
    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }
    setPasswordError('');
    setCurrentMgmtPassword('');
    setNextMgmtPassword('');
    Alert.alert('Updated', 'Management page password changed successfully.');
  };

  if (!isUnlocked) {
    return (
      <DashboardLayout title="User Management">
        <FormCard>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Restricted Access</Text>
            <InfoHint text="This page requires management password to open." />
          </View>
          <View style={styles.formGrid}>
            <View style={styles.formCell}>
              <TextInputField
                label="Management Password"
                value={accessPassword}
                onChangeText={setAccessPassword}
                secureTextEntry
              />
            </View>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
          <View style={styles.actions}>
            <PrimaryButton label="Unlock" onPress={unlockPage} />
            <Pressable style={styles.cancelButton} onPress={() => router.back()}>
              <Text style={styles.cancelText}>Back</Text>
            </Pressable>
          </View>
        </FormCard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Management">
      <FormCard>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>Management Password</Text>
            <InfoHint text="Password can be changed only after unlocking this page." />
          </View>
        </View>
        <View style={styles.formGrid}>
          <View style={styles.formCell}>
            <TextInputField
              label="Current Password"
              value={currentMgmtPassword}
              onChangeText={setCurrentMgmtPassword}
              secureTextEntry
            />
          </View>
          <View style={styles.formCell}>
            <TextInputField
              label="New Password"
              value={nextMgmtPassword}
              onChangeText={setNextMgmtPassword}
              secureTextEntry
            />
          </View>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
        <View style={styles.actions}>
          <PrimaryButton label="Change Password" onPress={updateManagementPassword} />
        </View>
      </FormCard>

      <FormCard>
        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>{editingId ? 'Edit User' : 'Add User'}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.formCell}>
            <TextInputField label="Full Name *" value={name} onChangeText={setName} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="Email *" value={email} onChangeText={setEmail} />
          </View>
          <View style={styles.formCell}>
            <TextInputField label="Password *" value={password} onChangeText={setPassword} secureTextEntry />
          </View>
          <View style={styles.formCell}>
            <SelectField label="Role" value={roleLabel(role)} onPress={cycleRole} />
          </View>
          <View style={styles.formCell}>
            <SelectField label="Status" value={status} onPress={cycleStatus} />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton label={editingId ? 'Update User' : 'Save User'} onPress={handleSave} />
          {editingId ? (
            <Pressable style={styles.cancelButton} onPress={resetForm}>
              <Text style={styles.cancelText}>Cancel Edit</Text>
            </Pressable>
          ) : null}
        </View>
      </FormCard>

      <DataTable
        columns={['User ID', 'Name', 'Email', 'Role', 'Status', 'Action']}
        columnWidths={[130, 170, 230, 150, 110, 300]}
        rows={sortedUsers.map((user) => [
          user.id,
          user.name,
          user.email,
          roleLabel(user.role),
          user.active ? 'Active' : 'Inactive',
          <View key={`${user.id}-actions`} style={styles.rowActions}>
            <Pressable
              style={styles.editButton}
              onPress={() => {
                setEditingId(user.id);
                setName(user.name);
                setEmail(user.email);
                setPassword(user.password);
                setRole(user.role);
                setStatus(user.active ? 'Active' : 'Inactive');
                setError('');
              }}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
            <Pressable
              style={styles.profileButton}
              onPress={() => router.push(`/receptionist/user-management/profile/${user.id}` as Href)}
            >
              <Text style={styles.profileText}>Profile</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                const doDelete = () => {
                  deleteUser(user.id);
                  if (editingId === user.id) resetForm();
                };

                if (currentUser?.id === user.id) {
                  Alert.alert('Blocked', 'You cannot delete your own signed-in account.');
                  return;
                }

                if (Platform.OS === 'web') {
                  const ok = typeof window !== 'undefined' ? window.confirm(`Delete user ${user.name}?`) : false;
                  if (!ok) return;
                  doDelete();
                  return;
                }

                Alert.alert('Delete User', `Delete user ${user.name}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: doDelete },
                ]);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>,
        ])}
      />
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
  titleRow: {
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
    fontSize: 14,
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
  errorText: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
  },
  actions: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  cancelText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.ink,
  },
  rowActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#93C5FD',
    backgroundColor: '#EFF6FF',
  },
  editText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#1D4ED8',
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEE2E2',
  },
  deleteText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#991B1B',
  },
  profileButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  profileText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#065F46',
  },
});
