import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useItemHistory } from '../hooks/useItemHistory';
import { useAppTheme, AppThemeType } from '../contexts/ThemeContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Icon } from './Icon';

// Mapping des noms de champs techniques vers des libellés français
const fieldTranslations: { [key: string]: string } = {
  name: 'Nom',
  description: 'Description',
  purchase_price: 'Prix d\'achat',
  selling_price: 'Prix de vente',
  status: 'Statut',
  container_id: 'Conteneur',
  category_id: 'Catégorie',
  location_id: 'Emplacement',
  qr_code: 'QR Code',
};

// Mapping pour les valeurs de statut
const statusTranslations: { [key: string]: string } = {
  available: 'Disponible',
  sold: 'Vendu',
};



interface ItemHistoryListProps {
  itemId: number;
}

const ItemHistoryList: React.FC<ItemHistoryListProps> = ({ itemId }) => {
  const { history, isLoading, error } = useItemHistory(itemId);
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);

  const renderDetail = (action: string, details: any) => {
    if (!details) return null;

    if (action === 'CREATED') {
      return <Text style={styles.detailText}>Article créé dans le système.</Text>;
    }

    if (action === 'UPDATED') {
      const changes = Object.keys(details.to)
        .filter(key => key !== 'updated_at') // Ignorer le champ de date de mise à jour
        .map(key => {
          const translatedKey = fieldTranslations[key] || key;
          let from = details.from[key];
          let to = details.to[key];

          // Traduire les statuts
          if (key === 'status') {
            from = statusTranslations[from] || from;
            to = statusTranslations[to] || to;
          }

          return (
            <View key={key} style={styles.changeRow}>
              <Text style={styles.detailKey}>{translatedKey}:</Text>
              <Text style={styles.detailOldValue}>{from || 'Non défini'}</Text>
              <Icon name="arrow_forward" size={12} color={activeTheme.text.secondary} />
              <Text style={styles.detailNewValue}>{to || 'Non défini'}</Text>
            </View>
          );
        });

      if (changes.length === 0) {
        return <Text style={styles.detailText}>Mise à jour mineure (pas de changement visible).</Text>;
      }

      return <View>{changes}</View>;
    }

    return <Text style={styles.detailText}>{JSON.stringify(details)}</Text>;
  };

  if (isLoading) {
    return <ActivityIndicator size="large" color={activeTheme.primary} style={{ marginTop: 20 }} />;
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (history.length === 0) {
    return <Text style={styles.emptyText}>Aucun historique pour cet article.</Text>;
  }

  return (
    <View style={styles.container}>
      {history.map((entry, index) => (
        <View key={entry.id} style={styles.entryContainer}>
          <View style={styles.timelineConnector}>
            <Icon name="circle" size={12} color={activeTheme.primary} />
            {index < history.length - 1 && <View style={styles.timelineLine} />}
          </View>
          <View style={styles.entryContent}>
            <Text style={styles.actionText}>{entry.action}</Text>
            <Text style={styles.dateText}>
              {format(new Date(entry.createdAt), 'd MMMM yyyy à HH:mm', { locale: fr })}
            </Text>
            <View style={styles.detailsContainer}>
              {renderDetail(entry.action, entry.details)}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    padding: 16,
  },
  entryContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineConnector: {
    alignItems: 'center',
    marginRight: 12,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.border,
  },
  entryContent: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  actionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text.primary,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: theme.text.secondary,
    marginBottom: 8,
  },
  detailsContainer: {
    marginTop: 8,
  },
  detailText: {
    fontSize: 14,
    color: theme.text.secondary,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailKey: {
    fontSize: 14,
    color: theme.text.primary,
    fontWeight: '500',
    marginRight: 8,
  },
  detailOldValue: {
    fontSize: 14,
    color: theme.text.secondary,
    textDecorationLine: 'line-through',
    marginRight: 4,
  },
  detailNewValue: {
    fontSize: 14,
    color: theme.success,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  errorText: {
    color: theme.error,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyText: {
    color: theme.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 20,
  },
});

export default ItemHistoryList;
