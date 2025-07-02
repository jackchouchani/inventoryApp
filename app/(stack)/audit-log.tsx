import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import CommonHeader from '../../src/components/CommonHeader';
import GlobalAuditLogList from '../../src/components/GlobalAuditLogList';
import { useAppTheme, AppThemeType } from '../../src/contexts/ThemeContext';

const AuditLogScreen = () => {
  const router = useRouter();
  const { activeTheme } = useAppTheme();
  const styles = getThemedStyles(activeTheme);

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
