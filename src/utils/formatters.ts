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