import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';

type FileUploadProps = {
  label: string;
  hint?: string;
  onPress?: () => void;
  onFileSelected?: (file: File | null) => void;
};

export function FileUpload({ label, hint, onPress, onFileSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const handlePress = () => {
    if (Platform.OS === 'web' && inputRef.current) {
      inputRef.current.click();
    }
    onPress?.();
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.drop} onPress={handlePress}>
        <Text style={styles.title}>{selectedName ?? 'uplod'}</Text>
      </Pressable>
      {Platform.OS === 'web'
        ? (
          <input
            ref={inputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedName(file?.name ?? null);
              onFileSelected?.(file);
            }}
          />
        )
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  label: {
    fontFamily: theme.font.body,
    color: theme.colors.ink,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  drop: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 12,
    color: theme.colors.ink,
  },
});
