import { Modal, StyleSheet, View } from 'react-native';

import { theme } from '@/constants/theme';

type DrawerProps = {
  visible: boolean;
  onClose?: () => void;
  children: React.ReactNode;
};

export function Drawer({ visible, onClose, children }: DrawerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
});
