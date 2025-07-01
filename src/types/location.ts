export interface Location {
  id: number;
  name: string;
  address?: string;
  description?: string;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  userId: string;
}

export interface LocationInput {
  name: string;
  address?: string;
  description?: string;
  qrCode: string;
  userId: string;
}

export interface LocationUpdate {
  name?: string;
  address?: string;
  description?: string;
}