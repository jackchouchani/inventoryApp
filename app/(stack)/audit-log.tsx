import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import CommonHeader from '../../src/components/CommonHeader';
import GlobalAuditLogList from '../../src/components/GlobalAuditLogList';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';
import { useUserPermissions } from '../../src/hooks/useUserPermissions';

const AuditLogScreen = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const userPermissions = useUserPermissions();
  const styles = getThemedStyles(activeTheme);

  // Vérifier les permissions
  useEffect(() => {
    if (!userPermissions.canViewAuditLog) {
      router.replace('/(tabs)/stock');
      return;
    }
  }, [userPermissions.canViewAuditLog, router]);

  // Si pas de permission, ne pas rendre le contenu
  if (!userPermissions.canViewAuditLog) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: activeTheme.text.primary, fontSize: 16 }}>
          Accès non autorisé - Permission requise pour accéder au journal d'audit
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommonHeader title="Journal d'Audit Global" onBackPress={() => router.back()} />
      <GlobalAuditLogList />
    </View>
  );
};

const getThemedStyles = (theme: AppThemeType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
});

export default AuditLogScreen;
