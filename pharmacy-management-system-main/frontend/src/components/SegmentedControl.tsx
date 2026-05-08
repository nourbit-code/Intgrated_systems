import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';

export function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option === value;
        return (
          <TouchableOpacity
            key={option}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.cardSoft,
    borderRadius: 999,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  segmentActive: {
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.accentCyan,
  },
  label: {
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  labelActive: {
    color: theme.colors.accentDeep,
  },
});
