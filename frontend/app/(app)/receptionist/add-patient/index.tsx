import { useMemo, useState } from 'react';
import { View, StyleSheet, Text, Pressable, Modal, Platform, TextInput } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { TextInputField } from '@/components/ui/TextInputField';
import { SelectField } from '@/components/ui/SelectField';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { theme } from '@/constants/theme';
import { useInsuranceSettings } from '@/hooks/useInsuranceSettings';
import { usePatients } from '@/hooks/usePatients';

const genderOptions = ['Male', 'Female'] as const;
type Gender = typeof genderOptions[number];

type Provider = string;

function formatDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeCode(input: string, prefix: string) {
  const raw = input.replace(prefix, '');
  const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '');
  return `${prefix}${cleaned}`;
}

export default function AddPatient() {
  const router = useRouter();
  const { addPatient } = usePatients();
  const { providers, addProvider: addProviderToSettings } = useInsuranceSettings();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceProvider, setInsuranceProvider] = useState<Provider | ''>('');
  const [policyNumber, setPolicyNumber] = useState('POL-');
  const [memberId, setMemberId] = useState('MEM-');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [insuranceExpiryDate, setInsuranceExpiryDate] = useState<Date | null>(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [newProvider, setNewProvider] = useState('');

  const isValid = name.trim() !== '' && age.trim() !== '' && phone.trim() !== '' && !!gender;

  const minExpiryDate = useMemo(() => {
    const today = new Date();
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    return next;
  }, []);

  const handleSubmit = () => {
    if (!isValid) return;
    addPatient({
      name: name.trim(),
      age: Number(age),
      gender,
      phone: phone.trim(),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      insuranceProvider: hasInsurance ? insuranceProvider || undefined : undefined,
      insurancePolicyNumber: hasInsurance ? policyNumber || undefined : undefined,
      insuranceMemberId: hasInsurance ? memberId || undefined : undefined,
      insuranceExpiry: hasInsurance ? insuranceExpiry || undefined : undefined,
    });
    router.push('/patients' as Href);
  };

  const handleAddProvider = () => {
    const trimmed = newProvider.trim();
    if (!trimmed) return;
    addProviderToSettings(trimmed);
    setInsuranceProvider(trimmed);
    setNewProvider('');
  };

  return (
    <DashboardLayout title="New Patient">
      <View style={styles.grid}>
        <FormCard>
          <View style={styles.fieldGrid}>
            <TextInputField label="Full Name *" value={name} onChangeText={setName} />
            <TextInputField label="Age *" value={age} onChangeText={setAge} />
            <View>
              <Text style={styles.fieldLabel}>Gender *</Text>
              <View style={styles.chipRow}>
                {genderOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setGender(option)}
                    style={[styles.chip, gender === option && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, gender === option && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </FormCard>

        <FormCard>
          <View style={styles.fieldGrid}>
            <TextInputField label="Phone *" value={phone} onChangeText={setPhone} />
            <TextInputField label="Email (optional)" value={email} onChangeText={setEmail} />
            <TextInputField label="Address (optional)" value={address} onChangeText={setAddress} />
          </View>
        </FormCard>

        <FormCard>
          <View style={styles.toggleRow}>
            <Pressable
              onPress={() => setHasInsurance(true)}
              style={[styles.chip, hasInsurance && styles.chipActive]}
            >
              <Text style={[styles.chipText, hasInsurance && styles.chipTextActive]}>Insured</Text>
            </Pressable>
            <Pressable
              onPress={() => setHasInsurance(false)}
              style={[styles.chip, !hasInsurance && styles.chipActive]}
            >
              <Text style={[styles.chipText, !hasInsurance && styles.chipTextActive]}>Self-pay</Text>
            </Pressable>
          </View>
          {hasInsurance ? (
            <View style={styles.fieldGrid}>
              <SelectField
                label="Insurance Company"
                value={insuranceProvider || undefined}
                onPress={() => setShowProviderPicker(true)}
              />
              <TextInputField
                label="Policy Number"
                value={policyNumber}
                onChangeText={(value) => setPolicyNumber(normalizeCode(value, 'POL-'))}
              />
              <TextInputField
                label="Member ID"
                value={memberId}
                onChangeText={(value) => setMemberId(normalizeCode(value, 'MEM-'))}
              />
              {Platform.OS === 'web' ? (
                <View style={styles.datePickerWrapper}>
                  <Text style={styles.fieldLabel}>Expiry</Text>
                  <DatePicker
                    selected={insuranceExpiryDate}
                    onChange={(date: Date | null) => {
                      if (!date) return;
                      if (date < minExpiryDate) return;
                      setInsuranceExpiryDate(date);
                      setInsuranceExpiry(formatDate(date));
                    }}
                    dateFormat="yyyy-MM-dd"
                    className="clinic-date-input"
                    minDate={minExpiryDate}
                    filterDate={(date) => date >= minExpiryDate}
                  />
                </View>
              ) : (
                <SelectField
                  label="Expiry"
                  value={insuranceExpiry || undefined}
                  onPress={() => setShowCalendar(true)}
                />
              )}
            </View>
          ) : null}
        </FormCard>
      </View>

      <View style={styles.actions}>
        <PrimaryButton label="Register Patient" onPress={handleSubmit} disabled={!isValid} />
      </View>

      <Modal visible={showProviderPicker} transparent animationType="fade" onRequestClose={() => setShowProviderPicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProviderPicker(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Insurance</Text>
            {providers.map((provider) => (
              <Pressable
                key={provider}
                onPress={() => {
                  setInsuranceProvider(provider);
                  setShowProviderPicker(false);
                }}
                style={styles.modalItem}
              >
                <Text style={styles.modalItemText}>{provider}</Text>
              </Pressable>
            ))}
            <View style={styles.addProviderRow}>
              <TextInput
                value={newProvider}
                onChangeText={setNewProvider}
                placeholderTextColor={theme.colors.slate}
                style={styles.addProviderInput}
              />
              <Pressable onPress={handleAddProvider} style={styles.addProviderButton}>
                <Text style={styles.addProviderButtonText}>Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCalendar(false)}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <Text style={styles.modalTitle}>Select Expiry</Text>
            <Text style={styles.modalItemText}>Calendar picker is available on web.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: theme.spacing.lg,
  },
  fieldGrid: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  fieldLabel: {
    fontFamily: theme.font.body,
    color: theme.colors.slate,
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: theme.spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  toggleRow: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
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
    alignItems: 'flex-start',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
  },
  modalTitle: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
  },
  modalItem: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalItemText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  datePickerWrapper: {
    gap: theme.spacing.xs,
  },
  addProviderRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  addProviderInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
    backgroundColor: '#FBFCFE',
  },
  addProviderButton: {
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProviderButtonText: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
});
