export interface Shelter {
  id: number;
  name: string;
  lat: number;
  lon: number;
  address: string;
  elevation: number;
  tsunami_safety_level: number;
  created_at: string; // ISO8601
}

export interface ShelterListResponse {
  items: Shelter[];
} 