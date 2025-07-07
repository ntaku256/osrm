export interface User {
  firebase_uid: string;
  username: string;
  age: number;
  gender: "male" | "female" | "other";
  has_disability: boolean;
  evacuation_level: number;
  is_firebase_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserUpdateRequest {
  username: string;
  age: number;
  gender: "male" | "female" | "other";
  has_disability: boolean;
  evacuation_level: number;
} 