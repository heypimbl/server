import options from "./options.ts";

const API_BASE = "https://geocode.maps.co/reverse";

export async function reverseGeocode(lat: number, lon: number) {
  if (!options.mapscoApiKey) throw new Error("PIMBL_MAPSCO_API_KEY not defined");

  const url = `${API_BASE}?lat=${lat}&lon=${lon}&api_key=${options.mapscoApiKey}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`geocode.maps.co API error: ${response.status}`);

  const data = await response.json();
  const { house_number, road, suburb } = data.address;
  return `${house_number} ${road} ${suburb}`;
}
