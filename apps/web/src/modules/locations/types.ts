export interface Location {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLocationInput {
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
}
