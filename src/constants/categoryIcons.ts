import { MaterialIconName } from '../types/icons';

export interface CategoryIcon {
  id: string;
  label: string;
  icon: MaterialIconName;
}

export const CATEGORY_ICONS: CategoryIcon[] = [
  { id: 'handbag', label: 'Sacs à main', icon: 'shopping_bag' },
  { id: 'coat', label: 'Manteaux', icon: 'style' },
  { id: 'dress', label: 'Robes', icon: 'accessibility' },
  { id: 'pants', label: 'Pantalons', icon: 'layers' },
  { id: 'shoes', label: 'Chaussures', icon: 'hiking' },
  { id: 'glasses', label: 'Lunettes', icon: 'visibility' },
  { id: 'jewelry', label: 'Bijoux', icon: 'diamond' },
  { id: 'accessories', label: 'Accessoires', icon: 'watch' },
  { id: 'skirt', label: 'Jupes', icon: 'straighten' },
  { id: 'top', label: 'Hauts', icon: 'checkroom' },
  { id: 'swimwear', label: 'Maillots de bain', icon: 'waves' },
  { id: 'lingerie', label: 'Lingerie', icon: 'favorite' },
  { id: 'scarf', label: 'Écharpes & Foulards', icon: 'texture' },
  { id: 'belt', label: 'Ceintures', icon: 'circle' },
  { id: 'other', label: 'Autres', icon: 'more_horiz' },
]; 