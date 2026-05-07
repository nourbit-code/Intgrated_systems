import { Text, TextProps } from './Themed';
import { theme } from '@/constants/theme';

export function MonoText(props: TextProps) {
  return <Text {...props} style={[props.style, { fontFamily: theme.font.body }]} />;
}
