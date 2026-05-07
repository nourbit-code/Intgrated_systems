import { useState } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { AuthLayout } from '@/components/layouts/AuthLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextInputField } from '@/components/ui/TextInputField';
import { PasswordField } from '@/components/ui/PasswordField';
import { theme } from '@/constants/theme';
import { Role, useAuth } from '@/hooks/useAuth';

const roleHomes: Record<Role, string> = {
  receptionist: '/receptionist',
  'lab-tech': '/lab-tech',
};

const roleLabels: Record<Role, string> = {
  receptionist: 'Receptionist',
  'lab-tech': 'Lab Technician',
};

export default function LoginScreen() {
  const router = useRouter();
  const { loginWithCredentials } = useAuth();
  const [role, setRole] = useState<Role>('receptionist');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const result = await loginWithCredentials(email, password, role);
    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    setError('');
    router.replace(roleHomes[role] as Href);
  };

  return (
    <AuthLayout title="AlphaLab">
      <View style={styles.hero}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>AL</Text>
        </View>
        <View>
          <Text style={styles.welcomeTitle}>Welcome back</Text>
          <Text style={styles.welcomeTag}>Front Desk Access</Text>
        </View>
      </View>

      <View style={styles.formStack}>
        <TextInputField
          label="Email"
          placeholder="you@clinic.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error) setError('');
          }}
        />
        <PasswordField
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (error) setError('');
          }}
        />
      </View>

      <View style={styles.roles}>
        {Object.entries(roleLabels).map(([value, label]) => (
          <Pressable
            key={value}
            onPress={() => {
              setRole(value as Role);
              if (error) setError('');
            }}
            style={[styles.rolePill, role === value && styles.roleActive]}
          >
            <Text style={[styles.roleText, role === value && styles.roleTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.actions}>
        <PrimaryButton label={submitting ? 'Signing In...' : 'Sign In'} onPress={handleSignIn} disabled={submitting} />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: '#ECFDF3',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  welcomeTitle: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  welcomeTag: {
    marginTop: 4,
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  formStack: {
    gap: theme.spacing.md,
  },
  actions: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  roles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  rolePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
  },
  roleActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  roleText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: theme.colors.slate,
  },
  roleTextActive: {
    color: '#166534',
  },
  errorText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#B91C1C',
  },
});
