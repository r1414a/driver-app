import polyline from "@mapbox/polyline";


export async function fetchRouteFromMapBox(){
 if (!trip || !userLoc) return;

  try {
    const coords = [
      `${userLoc.longitude},${userLoc.latitude}`,
      ...trip.stops.map(
        (s) => `${s.store.longitude},${s.store.latitude}`
      ),
    ].join(";");

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=polyline&access_token=${process.env.EXPO_PUBLIC_MAPBOX_API}`;

    const res = await fetch(url);
    const data = await res.json();

    const points = polyline.decode(data.routes[0].geometry);

    const route = points.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));

    setRouteCoords(route);
  } catch (e) {
    console.log("Route error", e);
  }
}