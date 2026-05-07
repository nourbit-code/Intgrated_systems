import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { theme } from '@/constants/theme';

type TextInputFieldProps = {
  label: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  secureTextEntry?: boolean;
  editable?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
};

export function TextInputField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  editable = true,
  keyboardType,
}: TextInputFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.slate}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        secureTextEntry={secureTextEntry}
        editable={editable}
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.font.body,
    color: theme.colors.slate,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  input: {
    backgroundColor: '#FBFCFE',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.ink,
  },
});

