export interface SensorReading {
  id: string;
  trashBinId: string;
  fillLevel: number;
  batteryLevel: number | null;
  temperature: number | null;
  latitude: number | null;
  longitude: number | null;
  payload: unknown;
  receivedAt: string;
  createdAt: string;
}
