import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Location } from '../types/location';
import { useAppTheme } from '../contexts/ThemeContext';
import { Icon } from './Icon';

interface LocationPickerProps {
  locations: Location[];
  selectedLocationId?: number | null;
  onLocationSelect: (locationId: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
  locations,
  selectedLocationId,
  onLocationSelect,
  placeholder = "Sélectionner un emplacement",
  disabled = false,
  required = false
}) => {
  const { activeTheme } = useAppTheme();
  const styles = useMemo(() => getStyles(activeTheme), [activeTheme]);

  const selectedLocation = locations.find(location => location.id === selectedLocationId);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const handleLocationPress = (locationId: number | null) => {
    onLocationSelect(locationId);
    setShowDropdown(false);
  };

  const renderLocationOption = (location: Location) => (
    <TouchableOpacity
      key={location.id}
      style={[
        styles.optionItem,
        selectedLocationId === location.id && styles.selectedOption
      ]}
      onPress={() => handleLocationPress(location.id)}
    >
      <View style={styles.optionContent}>
        <Text style={[
          styles.optionText,
          selectedLocationId === location.id && styles.selectedOptionText
        ]}>
          {location.name}
        </Text>
        {location.address && (
          <Text style={styles.optionSubtext}>
            📍 {location.address}
          </Text>
        )}
      </View>
      {selectedLocationId === location.id && (
        <Icon name="check" size={20} color={activeTheme.primary} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.selector,
          disabled && styles.disabledSelector,
          showDropdown && styles.activeSelector
        ]}
        onPress={() => !disabled && setShowDropdown(!showDropdown)}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <View style={styles.selectorTextContainer}>
            {selectedLocation ? (
              <>
                <Text style={styles.selectedText}>
                  {selectedLocation.name}
                </Text>
                {selectedLocation.address && (
                  <Text style={styles.selectedSubtext}>
                    📍 {selectedLocation.address}
                  </Text>
                )}
              </>
            ) : (
              <Text style={[
                styles.placeholderText,
                required && styles.requiredText
              ]}>
                {placeholder}{required && ' *'}
              </Text>
            )}
          </View>
          
          <View style={styles.selectorActions}>
            {selectedLocationId && !disabled && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLocationPress(null);
                }}
              >
                <Icon name="close" size={18} color={activeTheme.text.secondary} />
              </TouchableOpacity>
            )}
            <Icon 
              name={showDropdown ? "expand_less" : "expand_more"} 
              size={24} 
              color={disabled ? activeTheme.text.disabled : activeTheme.text.secondary} 
            />
          </View>
        </View>
      </TouchableOpacity>

      {showDropdown && !disabled && (
        <View style={styles.dropdown}>
          <ScrollView 
            style={styles.optionsList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Option "Aucun emplacement" */}
            <TouchableOpacity
              style={[
                styles.optionItem,
                selectedLocationId === null && styles.selectedOption
              ]}
              onPress={() => handleLocationPress(null)}
            >
              <View style={styles.optionContent}>
                <Text style={[
                  styles.optionText,
                  styles.noLocationText,
                  selectedLocationId === null && styles.selectedOptionText
                ]}>
                  Aucun emplacement
                </Text>
              </View>
              {selectedLocationId === null && (
                <Icon name="check" size={20} color={activeTheme.primary} />
              )}
            </TouchableOpacity>

            {/* Séparateur */}
            {locations.length > 0 && (
              <View style={styles.separator} />
            )}

            {/* Liste des emplacements */}
            {locations.map(renderLocationOption)}

            {/* Message si aucun emplacement */}
            {locations.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Aucun emplacement disponible
                </Text>
                <Text style={styles.emptySubtext}>
                  Créez d'abord un emplacement pour pouvoir le sélectionner
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  selector: {
    backgroundColor: theme.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  disabledSelector: {
    backgroundColor: theme.backgroundDisabled || `${theme.text.primary}10`,
    opacity: 0.6,
  },
  activeSelector: {
    borderColor: theme.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  selectedText: {
    fontSize: 16,
    color: theme.text.primary,
    fontWeight: '500',
  },
  selectedSubtext: {
    fontSize: 13,
    color: theme.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  placeholderText: {
    fontSize: 16,
    color: theme.text.secondary,
  },
  requiredText: {
    color: theme.error,
  },
  selectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    padding: 2,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.primary,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1001,
  },
  optionsList: {
    flex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  selectedOption: {
    backgroundColor: `${theme.primary}15`,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    color: theme.text.primary,
  },
  optionSubtext: {
    fontSize: 13,
    color: theme.text.secondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  selectedOptionText: {
    color: theme.primary,
    fontWeight: '600',
  },
  noLocationText: {
    fontStyle: 'italic',
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginVertical: 4,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.text.secondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
});