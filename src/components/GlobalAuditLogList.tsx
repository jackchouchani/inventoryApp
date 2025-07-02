import React, { useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { fetchGlobalAuditLog } from '../store/auditLogSlice';
import { useAppTheme, AppThemeType } from '../contexts/ThemeContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Icon } from './Icon';

const LOGS_PER_PAGE = 20;

// --- Dictionnaires de Traduction ---
const actionTranslations: { [key: string]: { text: string; icon: string; color: keyof AppThemeType['feedback'] } } = {
  CREATED: { text: 'Création', icon: 'add_circle', color: 'success' },
  UPDATED: { text: 'Modification', icon: 'edit', color: 'warning' },
  DELETED: { text: 'Suppression', icon: 'delete', color: 'error' },
};

const fieldTranslations: { [key: string]: string } = {
  name: 'Nom',
  description: 'Description',
  purchase_price: 'Prix d\'achat',
  selling_price: 'Prix de vente',
  status: 'Statut',
  container_id: 'Conteneur',
  category_id: 'Catégorie',
};

const statusTranslations: { [key: string]: string } = {
  available: 'Disponible',
  sold: 'Vendu',
};

const GlobalAuditLogList: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { logs, total, currentPage, isLoading, error } = useSelector((state: RootState) => state.auditLog);
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);

  useEffect(() => {
    dispatch(fetchGlobalAuditLog({ page: 0, limit: LOGS_PER_PAGE }));
  }, [dispatch]);

  const loadMore = () => {
    if (isLoading || logs.length >= total) return;
    dispatch(fetchGlobalAuditLog({ page: currentPage + 1, limit: LOGS_PER_PAGE }));
  };

  const renderLogDetails = (action: string, details: any) => {
    if (action !== 'UPDATED' || !details || !details.to) {
      return null;
    }

    const changes = Object.keys(details.to)
      .filter(key => key !== 'updated_at')
      .map(key => {
        const translatedKey = fieldTranslations[key] || key;
        let from = details.from[key];
        let to = details.to[key];

        if (key === 'status') {
          from = statusTranslations[from] || from;
          to = statusTranslations[to] || to;
        }

        return (
          <View key={key} style={styles.changeRow}>
            <Text style={styles.detailKey}>{` • ${translatedKey} :`}</Text>
            <Text style={styles.detailOldValue}>{from || '-'}</Text>
            <Icon name="arrow_forward" size={12} color={activeTheme.text.secondary} />
            <Text style={styles.detailNewValue}>{to || '-'}</Text>
          </View>
        );
      });

    return <View style={styles.detailsContainer}>{changes}</View>;
  };

  const renderItem = ({ item }: { item: any }) => {
    const translatedAction = actionTranslations[item.action] || { text: item.action, icon: 'history', color: 'info' };
    const actionColor = activeTheme.feedback[translatedAction.color] || activeTheme.primary;

    return (
      <View style={styles.logItemContainer}>
        <View style={[styles.iconContainer, { backgroundColor: `${actionColor}20` }]}>
          <Icon name={translatedAction.icon} size={20} color={actionColor} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={[styles.logAction, { color: actionColor }]}>{translatedAction.text}</Text>
            <Text style={styles.logDate}>{format(new Date(item.createdAt), 'd MMM yyyy, HH:mm', { locale: fr })}</Text>
          </View>
          <Text style={styles.logUser}>{`par ${item.userEmail || 'Système'}`}</Text>
          <Text style={styles.logDetails}>{`Article : ${item.itemName || 'Inconnu'}`}</Text>
          {renderLogDetails(item.action, item.details)}
        </View>
      </View>
    );
  };

  if (isLoading && logs.length === 0) {
    return <ActivityIndicator size="large" color={activeTheme.primary} style={{ marginTop: 20 }} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  return (
    <FlatList
      data={logs}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isLoading ? <ActivityIndicator size="small" color={activeTheme.primary} /> : null}
      contentContainerStyle={styles.listContainer}
    />
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  listContainer: {
    padding: 16,
  },
  logItemContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logAction: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logUser: {
    fontSize: 13,
    color: theme.text.secondary,
    marginBottom: 8,
  },
  logDetails: {
    fontSize: 14,
    color: theme.text.primary,
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: theme.border,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailKey: {
    fontSize: 13,
    color: theme.text.secondary,
  },
  detailOldValue: {
    fontSize: 13,
    color: theme.text.secondary,
    textDecorationLine: 'line-through',
    marginHorizontal: 4,
  },
  detailNewValue: {
    fontSize: 13,
    color: theme.success,
    fontWeight: 'bold',
  },
  logDate: {
    fontSize: 12,
    color: theme.text.secondary,
  },
  errorText: {
    color: theme.error,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default GlobalAuditLogList;
