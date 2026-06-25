import stopPayload from "../../stops.json";

type RawStop = {
  id: number;
  onestop_id: string;
  stop_code: string | null;
  stop_id: string | null;
  stop_name: string;
  stop_url: string | null;
  location_type: number | null;
  wheelchair_boarding: number | null;
  platform_code: string | null;
  zone_id: string | null;
  level: {
    level_name: string | null;
  } | null;
  parent: {
    stop_name: string;
  } | null;
  place: {
    adm1_name: string | null;
  } | null;
  feed_version: {
    feed: {
      onestop_id: string;
    };
  };
  geometry: {
    coordinates: [number, number];
    type: "Point";
  };
};

export type NormalizedStop = {
  id: string;
  onestopId: string;
  feedOnestopId: string;
  code: string;
  stopId: string;
  name: string;
  parentName: string | null;
  placeName: string;
  stopUrl: string | null;
  stopDomain: string | null;
  locationType: number | null;
  wheelchairBoarding: number | null;
  wheelchairLabel: string;
  platformCode: string | null;
  zoneId: string | null;
  levelName: string | null;
  coordinates: [number, number];
  searchText: string;
};

function domainFromUrl(url: string | null) {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function wheelchairLabel(value: number | null) {
  if (value === 1) return "Official boarding flag";
  if (value === 2) return "Official no-boarding flag";
  return "No official boarding flag";
}

function normalizeStop(stop: RawStop): NormalizedStop {
  const stopDomain = domainFromUrl(stop.stop_url);

  return {
    id: String(stop.id),
    onestopId: stop.onestop_id,
    feedOnestopId: stop.feed_version.feed.onestop_id,
    code: stop.stop_code ?? "",
    stopId: stop.stop_id ?? "",
    name: stop.stop_name,
    parentName: stop.parent?.stop_name ?? null,
    placeName: stop.place?.adm1_name ?? "",
    stopUrl: stop.stop_url,
    stopDomain,
    locationType: stop.location_type,
    wheelchairBoarding: stop.wheelchair_boarding,
    wheelchairLabel: wheelchairLabel(stop.wheelchair_boarding),
    platformCode: stop.platform_code,
    zoneId: stop.zone_id,
    levelName: stop.level?.level_name ?? null,
    coordinates: stop.geometry.coordinates,
    searchText: [
      stop.stop_name,
      stop.stop_code,
      stop.stop_id,
      stop.parent?.stop_name,
      stopDomain,
      stop.level?.level_name,
      stop.zone_id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  };
}

const rawStops = (stopPayload as { stops: RawStop[] }).stops;

export const stops = rawStops.map(normalizeStop).sort((left, right) => {
  return left.name.localeCompare(right.name);
});

export const stopById = new Map(stops.map((stop) => [stop.id, stop]));

const coordinates = stops.map((stop) => stop.coordinates);
const longitudes = coordinates.map(([longitude]) => longitude);
const latitudes = coordinates.map(([, latitude]) => latitude);

export const stopBounds: [[number, number], [number, number]] = [
  [Math.min(...longitudes), Math.min(...latitudes)],
  [Math.max(...longitudes), Math.max(...latitudes)],
];

export const stopCenter: [number, number] = [
  (stopBounds[0][0] + stopBounds[1][0]) / 2,
  (stopBounds[0][1] + stopBounds[1][1]) / 2,
];

export const stopStats = {
  total: stops.length,
  withOfficialBoardingFlag: stops.filter(
    (stop) => stop.wheelchairBoarding === 1,
  ).length,
  withAgencyLink: stops.filter((stop) => Boolean(stop.stopUrl)).length,
  withParentStation: stops.filter((stop) => Boolean(stop.parentName)).length,
};
