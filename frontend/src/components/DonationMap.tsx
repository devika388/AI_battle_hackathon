import { useEffect } from "react";
import { LatLngBounds } from "leaflet";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapLocation {
  label: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

function FitMapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const signature = points.map((point) => point.join(",")).join(";");
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(new LatLngBounds(points), { padding: [28, 28] });
    }
  }, [map, signature]);
  return null;
}

function coordinates(location: MapLocation): [number, number] | null {
  if (
    typeof location.latitude !== "number" ||
    typeof location.longitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    location.longitude < -180 ||
    location.longitude > 180
  ) return null;
  return [location.latitude, location.longitude];
}

function distanceKm(start: [number, number], end: [number, number]) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(end[0] - start[0]);
  const longitudeDelta = radians(end[1] - start[1]);
  const a = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(start[0])) * Math.cos(radians(end[0])) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DonationMap({
  locations,
  route = false,
}: {
  locations: MapLocation[];
  route?: boolean;
}) {
  const placed = locations.flatMap((location) => {
    const position = coordinates(location);
    return position ? [{ location, position }] : [];
  });
  const fallbackLocations = locations.filter((location) => !coordinates(location));
  const routeDistance = placed.length === 2
    ? distanceKm(placed[0].position, placed[1].position)
    : null;

  return (
    <div className="space-y-3">
      {placed.length ? (
        <div className="overflow-hidden rounded-2xl border border-charcoal/10">
          <MapContainer
            center={placed[0].position}
            className="h-72 w-full"
            scrollWheelZoom={false}
            zoom={placed.length > 1 ? 11 : 13}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitMapBounds points={placed.map((item) => item.position)} />
            {placed.map(({ location, position }, index) => (
              <CircleMarker
                center={position}
                key={`${location.label}-${index}`}
                pathOptions={{ color: index === 0 ? "#24583e" : "#d9b754", fillOpacity: 0.9 }}
                radius={9}
              >
                <Popup>
                  <strong>{location.label}</strong>
                  <br />
                  {location.address}
                </Popup>
              </CircleMarker>
            ))}
            {route && placed.length === 2 ? (
              <Polyline
                positions={placed.map((item) => item.position)}
                pathOptions={{ color: "#24583e", dashArray: "8 8" }}
              />
            ) : null}
          </MapContainer>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-charcoal/15 bg-[#f7f6f0] p-5 text-sm text-slate-600">
          No saved coordinates are available for this map. Addresses are shown below; FoodBridge does not estimate locations.
        </div>
      )}
      {route && routeDistance !== null ? (
        <p className="text-xs text-slate-500">
          Straight-line distance: {routeDistance.toFixed(1)} km. The dashed line is a visual aid, not a road route or travel-time guarantee.
        </p>
      ) : null}
      {fallbackLocations.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {fallbackLocations.map((location, index) => (
            <a
              className="rounded-xl border border-charcoal/8 bg-white p-3 text-sm hover:border-forest/30"
              href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(location.address)}`}
              key={`${location.label}-address-${index}`}
              rel="noreferrer"
              target="_blank"
            >
              <span className="block font-semibold text-charcoal">{location.label}</span>
              <span className="mt-1 block text-slate-500">{location.address || "Address not saved"}</span>
              <span className="mt-2 block text-xs font-medium text-forest">Search this saved address on OpenStreetMap ↗</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
