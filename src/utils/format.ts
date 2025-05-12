/**
 * Utilitaires de formatage pour l'application
 */

/**
 * Formate une valeur en devise (EUR par défaut)
 * @param value - Valeur à formater
 * @param locale - Locale à utiliser pour le formatage (fr-FR par défaut)
 * @param currency - Devise à utiliser (EUR par défaut)
 * @returns Valeur formatée
 */
export const formatCurrency = (
  value: number | string,
  locale = 'fr-FR',
  currency = 'EUR'
): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Si la valeur n'est pas un nombre valide, retourner "N/A"
  if (isNaN(numValue)) return 'N/A';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

/**
 * Formate une date en chaîne de caractères
 * @param date - Date à formater
 * @param locale - Locale à utiliser pour le formatage (fr-FR par défaut)
 * @returns Date formatée
 */
export const formatDate = (
  date: Date | string,
  locale = 'fr-FR'
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Vérifier si la date est valide
  if (isNaN(dateObj.getTime())) return 'Date invalide';
  
  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

/**
 * Formate un pourcentage
 * @param value - Valeur à formater (entre 0 et 1)
 * @param locale - Locale à utiliser pour le formatage (fr-FR par défaut)
 * @returns Pourcentage formaté
 */
export const formatPercentage = (
  value: number,
  locale = 'fr-FR'
): string => {
  // Si la valeur n'est pas un nombre valide, retourner "N/A"
  if (isNaN(value)) return 'N/A';
  
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}; 