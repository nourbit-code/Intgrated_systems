import { View, StyleSheet } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FileUpload } from '@/components/ui/FileUpload';
import { FormCard } from '@/components/ui/FormCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextArea } from '@/components/ui/TextArea';
import { theme } from '@/constants/theme';

export default function UploadResults() {
  return (
    <DashboardLayout title="Upload Results" subtitle="Attach lab reports">
      <FormCard>
        <FileUpload label="Result File" />
        <TextArea label="Notes" placeholder="Add observations" />
        <View style={styles.actions}>
          <PrimaryButton label="Submit" />
        </View>
      </FormCard>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: theme.spacing.md,
  },
});
