export interface Source {
    id: number;
    name: string;
    type: 'Marché' | 'Boutique' | 'En ligne' | 'Particulier';
    city?: string;
    createdAt: string;
    userId: string;
}

export type SourceInput = Omit<Source, 'id' | 'createdAt' | 'userId'>;
export type SourceUpdate = Partial<SourceInput>;