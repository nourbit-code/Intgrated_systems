import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function DataTable({ columns, rows }) {
  return (
    <View>
      <View style={styles.header}>
        {columns.map((col) => (
          <Text key={col.key} style={[styles.cell, col.wide && styles.cellWide]}>
            {col.label}
          </Text>
        ))}
      </View>
      {rows.map((row, index) => (
        <View key={row.key || index} style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
          {columns.map((col) => (
            <View key={col.key} style={[styles.cell, col.wide && styles.cellWide, styles.cellBlock]}>
              {col.render ? col.render(row) : <Text style={styles.value}>{row[col.key]}</Text>}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.tableHeader,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.borderSoft,
  },
  rowAlt: {
    backgroundColor: theme.colors.rowAlt,
  },
  cell: {
    flex: 1,
    fontSize: 11,
    color: theme.colors.inkMuted,
    fontFamily: theme.fonts.body,
  },
  cellWide: {
    flex: 2,
  },
  cellBlock: {
    justifyContent: 'center',
  },
  value: {
    fontSize: 12,
    color: theme.colors.ink,
    fontFamily: theme.fonts.body,
  },
});
