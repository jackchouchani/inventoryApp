export const formatPrice = (price: number | null | undefined): string => {
  if (price === null || price === undefined) {
    return 'Prix non défini';
  }
  return `${price.toFixed(2)} €`;
};

export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatQuantity = (quantity: number): string => {
  return quantity === 1 ? '1 unité' : `${quantity} unités`;
};

/**
 * Formate un nombre en devise (EUR)
 * @param value - Le montant à formater
 * @returns La chaîne formatée (ex: 1 234,56 €)
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
};

/**
 * Formate un pourcentage
 * @param value - La valeur à formater
 * @param decimals - Le nombre de décimales (défaut: 1)
 * @returns La chaîne formatée (ex: 12,3%)
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value / 100);
}; 