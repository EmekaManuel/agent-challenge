export interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
    admin1?: string;
  }[];
}

export interface WeatherForecastResponse {
  daily?: {
    time?: string[];
    weathercode?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
  error?: boolean;
  reason?: string;
}
