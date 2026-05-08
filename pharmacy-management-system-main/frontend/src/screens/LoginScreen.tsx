import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { login } from '../api/auth';
import { API_BASE_URL } from '../api/config';
import { AppBackground } from '../components/AppBackground';
import { PrimaryButton } from '../components/Buttons';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { Notice } from '../components/Notice';
import { theme } from '../theme';

type LoginError = Error & {
  status?: number;
  data?: {
    non_field_errors?: string[];
    [key: string]: unknown;
  };
};

export function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await login(username.trim(), password.trim());
      const token = response?.token || response?.key || response?.access || '';
      if (!token) {
        throw new Error('Missing token');
      }
      onLogin({
        name: String(response?.user?.username || username.trim() || 'Pharmacy User'),
        token,
        role: 'admin' as any,
      });
    } catch (err) {
      const loginError = err as LoginError;
      const backendMessage = loginError?.data?.non_field_errors?.[0];
      if (backendMessage) {
        setError(`${backendMessage} (API: ${API_BASE_URL})`);
      } else if (loginError?.status) {
        setError(`Login failed (${loginError.status}). API: ${API_BASE_URL}`);
      } else {
        setError(`Cannot reach backend at ${API_BASE_URL}.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppBackground />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card variant="white" style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Pharmacy Login</Text>
              <Text style={styles.subtitle}>
                Sign in with the admin account to manage prescriptions, inventory, billing, and dispensing.
              </Text>
              <Text style={styles.meta}>
                Use the admin account for the full system.
              </Text>
            </View>

            <InputField
              label="Username"
              placeholder="admin"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <InputField
              label="Password"
              placeholder="password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <View style={styles.buttonRow}>
              <PrimaryButton label={loading ? 'Signing In...' : 'Sign In'} onPress={handleSubmit} />
            </View>

            {error ? <Notice title="Authentication" message={error} tone="warning" /> : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    maxWidth: 460,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    color: theme.colors.ink,
    fontFamily: theme.fonts.heading,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  meta: {
    marginTop: 8,
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  buttonRow: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
});
