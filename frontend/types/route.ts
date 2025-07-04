export interface RouteLocation {
  lat: number;
  lon: number;
}

export type ObstacleDetectionMethod = 'nodes' | 'distance' | 'both'

export interface RouteWithObstaclesRequest {
  locations: RouteLocation[];
  waypoints?: RouteLocation[];
  exclude_locations?: RouteLocation[];
  language?: string;
  costing?: string;
  detection_method?: ObstacleDetectionMethod;
  distance_threshold?: number;
  alternates?: {
    destination_only?: boolean;
    alternates?: number;
  };
}

export interface RouteLocationInfo {
  type: string;
  lat: number;
  lon: number;
  original_index: number;
  way_id?: number;
  distance?: number;
}

export interface RouteManeuver {
  type: number;
  instruction: string;
  verbal_transition_alert_instruction?: string;
  verbal_succinct_transition_instruction?: string;
  verbal_pre_transition_instruction?: string;
  verbal_post_transition_instruction?: string;
  street_names?: string[];
  bearing_before?: number;
  bearing_after?: number;
  time: number;
  length: number;
  cost: number;
  begin_shape_index: number;
  end_shape_index: number;
  travel_mode?: string;
  travel_type?: string;
  has_time_restrictions?: boolean;
}

export interface RouteSummary {
  has_time_restrictions: boolean;
  has_toll: boolean;
  has_highway: boolean;
  has_ferry: boolean;
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  time: number;
  length: number;
  cost: number;
}

export interface RouteLeg {
  maneuvers: RouteManeuver[];
  summary: RouteSummary;
  shape: string;
}

export interface RouteTrip {
  locations: RouteLocationInfo[];
  legs: RouteLeg[];
  summary: RouteSummary;
  status_message: string;
  status: number;
  units: string;
  language: string;
  obstacles?: Array<{
    id: number;
    position: [number, number];
    type: number;
    description: string;
    dangerLevel: number;
    image_s3_key?: string;
    createdAt: string;
  }>;
}

export interface RouteAdmin {
  admin_level: number;
  iso_3166_1_alpha3: string;
  iso_3166_1: string;
}

export interface RouteAlternate {
  trip: RouteTrip;
}

export interface RouteResponse {
  trip?: RouteTrip;       // 単一ルートの場合
  alternates?: RouteAlternate[]; // 複数ルートの場合
  admins: RouteAdmin[];
  units: string;
  language: string;
} 