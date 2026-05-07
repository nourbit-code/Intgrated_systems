import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type InfoHintProps = {
  text: string;
  width?: number;
};

export function InfoHint({ text, width = 300 }: InfoHintProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.button}
        onHoverIn={() => setVisible(true)}
        onHoverOut={() => setVisible(false)}
        onPress={() => setVisible((prev) => !prev)}
      >
        <Text style={styles.buttonText}>i</Text>
      </Pressable>
      {visible ? (
        <View style={[styles.tooltip, { width }]}>
          <Text style={styles.tooltipText}>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  button: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: theme.font.heading,
    fontSize: 11,
    color: theme.colors.slate,
    lineHeight: 12,
  },
  tooltip: {
    position: 'absolute',
    top: 24,
    left: 0,
    zIndex: 50,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0F172A',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  tooltipText: {
    fontFamily: theme.font.body,
    fontSize: 12,
    color: '#F8FAFC',
  },
});
