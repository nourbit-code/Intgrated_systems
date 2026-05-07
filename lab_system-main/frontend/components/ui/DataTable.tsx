import { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/constants/theme';
import { Card } from './Card';

type DataTableProps = {
  title?: string;
  columns: string[];
  rows: ReactNode[][];
  rowKeys?: string[];
  onRowPress?: (index: number) => void;
  columnWidths?: number[];
  rowA11yLabels?: string[];
  bodyMaxHeight?: number;
  showsVerticalScrollIndicator?: boolean;
  embedded?: boolean;
};

export function DataTable({
  title,
  columns,
  rows,
  rowKeys,
  onRowPress,
  columnWidths,
  rowA11yLabels,
  bodyMaxHeight,
  showsVerticalScrollIndicator = true,
  embedded = false,
}: DataTableProps) {
  const body = (
    <>
      {rows.map((row, index) => {
        const content = (
          <>
            {row.map((cell, cellIndex) => (
              <View
                key={`cell-${index}-${cellIndex}`}
                style={[
                  styles.cell,
                  columnWidths?.[cellIndex] ? { width: columnWidths[cellIndex], minWidth: columnWidths[cellIndex] } : null,
                ]}
              >
                {typeof cell === 'string' || typeof cell === 'number' ? (
                  <Text style={styles.cellText}>{cell}</Text>
                ) : (
                  cell
                )}
              </View>
            ))}
          </>
        );

        const rowKeyBase = rowKeys?.[index] ?? `row-${index}`;
        const rowKey = `${rowKeyBase}-${index}`;
        return (
          <Pressable
            key={rowKey}
            style={({ hovered }) => [styles.row, hovered && styles.rowHover]}
            onPress={() => onRowPress?.(index)}
            accessibilityRole={onRowPress ? 'button' : undefined}
            accessibilityLabel={rowA11yLabels?.[index]}
          >
            {content}
          </Pressable>
        );
      })}
    </>
  );

  const tableContent = (
    <>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.header]}>
            {columns.map((col, colIndex) => (
              <Text
                key={col}
                style={[
                  styles.cell,
                  styles.headerText,
                  columnWidths?.[colIndex] ? { width: columnWidths[colIndex], minWidth: columnWidths[colIndex] } : null,
                ]}
                accessibilityRole="header"
              >
                {col}
              </Text>
            ))}
          </View>
          {bodyMaxHeight ? (
            Platform.OS === 'web' ? (
              <View style={[styles.bodyScrollWeb, { maxHeight: bodyMaxHeight }]}>
                {body}
              </View>
            ) : (
              <ScrollView style={{ maxHeight: bodyMaxHeight }} showsVerticalScrollIndicator={showsVerticalScrollIndicator}>
                {body}
              </ScrollView>
            )
          ) : (
            body
          )}
        </View>
      </ScrollView>
    </>
  );

  if (embedded) {
    return <View style={styles.embeddedWrap}>{tableContent}</View>;
  }

  return <Card style={styles.card}>{tableContent}</Card>;
}

const styles = StyleSheet.create({
  card: {
    padding: theme.spacing.md,
  },
  embeddedWrap: {
    marginTop: theme.spacing.md,
  },
  title: {
    fontFamily: theme.font.heading,
    fontSize: 16,
    color: theme.colors.ink,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.sm,
  },
  rowHover: {
    backgroundColor: '#F6F8FB',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: '#F8FAFC',
  },
  cell: {
    minWidth: 130,
    paddingRight: theme.spacing.md,
  },
  headerText: {
    fontFamily: theme.font.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 11,
    color: theme.colors.slate,
  },
  cellText: {
    fontFamily: theme.font.body,
    fontSize: 14,
    color: theme.colors.ink,
  },
  bodyScrollWeb: {
    overflowY: 'auto',
  },
});
