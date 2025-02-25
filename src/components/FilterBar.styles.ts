import { StyleSheet } from 'react-native';
import { theme } from '../utils/theme';

export const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    paddingHorizontal: theme.spacing.md,
    paddingLeft: 40,
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.primary,
  },
  filterButton: {
    marginLeft: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
  },
  filtersContainer: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  filterSection: {
    marginBottom: theme.spacing.md,
  },
  filterTitle: {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: 16,
    marginRight: theme.spacing.sm,
  },
  filterChipSelected: {
    backgroundColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.secondary,
    marginLeft: theme.spacing.xs,
  },
  filterChipTextSelected: {
    color: theme.colors.text.inverse,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  priceInput: {
    flex: 1,
    height: 40,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.primary,
  },
  priceSeparator: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
  },
}); 