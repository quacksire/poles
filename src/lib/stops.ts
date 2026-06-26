import { gtfsFeed, gtfsStops, type GtfsRoute, type GtfsStop } from "@/lib/gtfs";

export type NormalizedStop = GtfsStop;
export type NormalizedRoute = GtfsRoute;

export const stops = gtfsStops;
export const stopById = new Map(stops.map((stop) => [stop.id, stop]));

const coordinates = stops.map((stop) => stop.coordinates);

export const stopBounds: [[number, number], [number, number]] = coordinates.length
  ? [
      [
        Math.min(...coordinates.map(([longitude]) => longitude)),
        Math.min(...coordinates.map(([, latitude]) => latitude)),
      ],
      [
        Math.max(...coordinates.map(([longitude]) => longitude)),
        Math.max(...coordinates.map(([, latitude]) => latitude)),
      ],
    ]
  : [
      [-122.4194, 37.7749],
      [-122.4194, 37.7749],
    ];

export const stopCenter: [number, number] = [
  (stopBounds[0][0] + stopBounds[1][0]) / 2,
  (stopBounds[0][1] + stopBounds[1][1]) / 2,
];

export const stopStats = {
  total: stops.length,
  served: stops.filter((stop) => stop.isServed).length,
  unserved: stops.filter((stop) => !stop.isServed).length,
  withOfficialBoardingFlag: stops.filter(
    (stop) => stop.wheelchairBoarding === 1,
  ).length,
  withReferenceLink: stops.filter((stop) => Boolean(stop.stopUrl)).length,
  withMultipleRoutes: stops.filter((stop) => stop.routeCount > 1).length,
};

export const feedStats = {
  title: gtfsFeed.title,
  primaryAgencyName: gtfsFeed.primaryAgencyName,
  agencies: gtfsFeed.agencies,
  routeCount: gtfsFeed.routeCount,
  stopCount: gtfsFeed.stopCount,
  servedStopCount: gtfsFeed.servedStopCount,
  unservedStopCount: gtfsFeed.unservedStopCount,
  serviceWindowLabel: gtfsFeed.serviceWindowLabel,
  feedId: gtfsFeed.feedId,
  feedVersion: gtfsFeed.feedVersion,
  publisherName: gtfsFeed.publisherName,
  publisherUrl: gtfsFeed.publisherUrl,
  timezone: gtfsFeed.timezone,
  fingerprint: gtfsFeed.fingerprint,
};
