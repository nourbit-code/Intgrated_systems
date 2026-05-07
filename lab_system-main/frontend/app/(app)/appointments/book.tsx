import { View, StyleSheet } from 'react-native';

import { WizardLayout } from '@/components/layouts/WizardLayout';
import { DatePicker } from '@/components/ui/DatePicker';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SelectField } from '@/components/ui/SelectField';
import { StepHeader } from '@/components/ui/StepHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { theme } from '@/constants/theme';

export default function BookLabTest() {
  return (
    <WizardLayout>
      <StepHeader step="Step 1" title="Select Test" />
      <SelectField label="Test Type" placeholder="Choose test" />
      <SelectField label="Technician" placeholder="Assign lab tech" />
      <StepHeader step="Step 2" title="Pick Date" />
      <DatePicker label="Appointment" />
      <SummaryCard
        title="Summary"
        items={[
          { label: 'Test', value: 'CBC Panel' },
          { label: 'Date', value: 'Mar 12, 2026' },
          { label: 'Price', value: '450 EGP' },
        ]}
      />
      <View style={styles.actions}>
        <PrimaryButton label="Confirm Booking" />
      </View>
    </WizardLayout>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: theme.spacing.md,
  },
});
