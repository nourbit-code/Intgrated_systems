import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { theme } from '@/constants/theme';

type SearchInputProps = {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  enableVoice?: boolean;
};

export function SearchInput({ placeholder, value, onChangeText, enableVoice }: SearchInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const pulse = useRef(new Animated.Value(0)).current;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranscriptRef = useRef('');
  const voiceLangsRef = useRef<string[]>([]);
  const voiceLangIndexRef = useRef(0);

  const playBeep = (frequency: number, duration = 0.12) => {
    if (Platform.OS !== 'web') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current!;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore audio errors
    }
  };

  useEffect(() => {
    if (!isListening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isListening, pulse]);

  const startVoiceRecognition = (SpeechRecognitionCtor: any, lang: string) => {
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;
    const scheduleAutoStop = () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = setTimeout(() => {
        recognitionRef.current?.stop?.();
      }, 9000);
    };
    recognition.onstart = () => {
      setVoiceError('');
      setIsListening(true);
      playBeep(880);
      scheduleAutoStop();
    };
    recognition.onend = () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsListening(false);
      playBeep(440);
      recognitionRef.current = null;
      if (!lastTranscriptRef.current) {
        setVoiceError('No speech detected. Tap mic and speak right away.');
      }
    };
    recognition.onerror = (event: any) => {
      const error = event?.error;
      if (error === 'no-speech' && voiceLangIndexRef.current < voiceLangsRef.current.length - 1) {
        voiceLangIndexRef.current += 1;
        const nextLang = voiceLangsRef.current[voiceLangIndexRef.current];
        setVoiceError(`Retrying with ${nextLang}...`);
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        setTimeout(() => startVoiceRecognition(SpeechRecognitionCtor, nextLang), 120);
        return;
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setIsListening(false);
      recognitionRef.current = null;
      if (error === 'not-allowed') {
        setVoiceError('Microphone permission blocked. Please allow mic access.');
      } else if (error === 'audio-capture') {
        setVoiceError('No microphone found.');
      } else if (error === 'invalid-state') {
        setVoiceError('Microphone is busy. Wait a second and try again.');
      } else if (error) {
        setVoiceError(`Voice search error: ${error}.`);
      } else {
        setVoiceError('Voice search failed. Try again.');
      }
    };
    recognition.onresult = (event: any) => {
      const lastIndex = event?.results?.length ? event.results.length - 1 : 0;
      const transcript = event?.results?.[lastIndex]?.[0]?.transcript?.trim?.() ?? '';
      if (transcript) {
        lastTranscriptRef.current = transcript;
        setVoiceError('');
        onChangeText?.(transcript);
        scheduleAutoStop();
      }
    };
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setVoiceError('Could not start microphone. Please try again.');
    }
  };

  const handleVoice = async () => {
    if (Platform.OS !== 'web') return;
    if (!window.isSecureContext) {
      setVoiceError('Voice search needs https or localhost.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop?.();
      return;
    }
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice search not supported in this browser.');
      return;
    }
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setVoiceError('Cannot access microphone. Check browser mic permission and selected input device.');
      return;
    }
    lastTranscriptRef.current = '';
    const langs = Array.from(new Set([navigator.language || 'en-US', 'ar-EG', 'en-US']));
    voiceLangsRef.current = langs;
    voiceLangIndexRef.current = 0;
    startVoiceRecognition(SpeechRecognition, langs[0]);
  };

  return (
    <View style={styles.wrapper}>
      <TextInput
        placeholder={placeholder ?? 'Search'}
        placeholderTextColor={theme.colors.slate}
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
      />
      {value ? (
        <Pressable onPress={() => onChangeText?.('')} style={styles.clearButton}>
          <Ionicons name="close" size={12} color={theme.colors.slate} />
        </Pressable>
      ) : null}
      {enableVoice && Platform.OS === 'web' ? (
        <Pressable onPress={handleVoice} style={[styles.voiceButton, isListening && styles.voiceButtonActive]}>
          {isListening ? (
            <Animated.View
              style={[
                styles.voicePulse,
                {
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                  transform: [
                    {
                      scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
          <Ionicons name="mic" size={14} color={isListening ? '#16A34A' : '#22C55E'} />
        </Pressable>
      ) : null}
      {isListening ? <Text style={styles.voiceListening}>Listening…</Text> : null}
      {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    position: 'relative',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.font.body,
    fontSize: 15,
    color: theme.colors.ink,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    paddingRight: 64,
  },
  clearButton: {
    position: 'absolute',
    right: 36,
    top: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voiceButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  voiceButtonActive: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  voicePulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  voiceListening: {
    marginTop: 6,
    fontFamily: theme.font.body,
    fontSize: 10,
    color: '#16A34A',
  },
  voiceError: {
    marginTop: 6,
    fontFamily: theme.font.body,
    fontSize: 10,
    color: '#DC2626',
  },
});
