export interface Container {
    id: number;
    name: string;
    description?: string;
    number: number;
    qrCode: string;
    createdAt: string;
    updatedAt: string;
    deleted?: boolean;
    userId?: string;
}

export type ContainerInput = Omit<Container, 'id' | 'createdAt' | 'updatedAt'>;
export type ContainerUpdate = Partial<ContainerInput>; 