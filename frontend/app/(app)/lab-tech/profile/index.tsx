import { Text } from 'react-native';

import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { FormCard } from '@/components/ui/FormCard';
import { UserProfileSummaryCard } from '@/components/ui/UserProfileSummaryCard';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

export default function LabTechProfile() {
  const { currentUser, users } = useAuth();
  const user = users.find((item) => item.id === currentUser?.id);

  return (
    <DashboardLayout title="Profile">
      {user ? (
        <UserProfileSummaryCard user={user} title="My Profile" />
      ) : (
        <FormCard>
          <Text style={{ fontFamily: theme.font.body, color: theme.colors.ink }}>Profile data is not available.</Text>
        </FormCard>
      )}
    </DashboardLayout>
  );
}
