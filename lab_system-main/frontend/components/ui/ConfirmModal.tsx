import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { PrimaryButton } from './PrimaryButton';

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export function ConfirmModal({ visible, title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <PrimaryButton label="Confirm" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    width: '100%',
    maxWidth: 520,
    maxHeight: '88%',
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 18,
    color: theme.colors.ink,
  },
  message: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.slate,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cancel: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
});
