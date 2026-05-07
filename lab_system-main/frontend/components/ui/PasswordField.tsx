import { TextInputField } from './TextInputField';

type PasswordFieldProps = {
  label?: string;
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
};

export function PasswordField({
  label = 'Password',
  placeholder = 'Enter your password',
  value,
  onChangeText,
}: PasswordFieldProps) {
  return (
    <TextInputField
      label={label}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      secureTextEntry
    />
  );
}
