export interface ItemHistory {
  id: number;
  itemId: number;
  userId: string;
  action: string;
  details: any;
  createdAt: string;
  itemName?: string; // Nom de l'article affecté
  userEmail?: string; // Email de l'utilisateur
}
