import { pool } from "@workspace/db";

type DbQueryable = Pick<typeof pool, "query">;

export type ServiceLocationMode = "registered" | "last_work" | "current";

export interface TechnicianServiceLocationRow {
  governorate: string | null;
  area: string | null;
  registeredLat: number | null;
  registeredLon: number | null;
  activeLat: number | null;
  activeLon: number | null;
  previousActiveLat: number | null;
  previousActiveLon: number | null;
  lastWorkLat: number | null;
  lastWorkLon: number | null;
  serviceLocationMode: ServiceLocationMode | null;
  serviceLocationDay: string | null;
}

export interface ResolvedServiceLocation {
  mode: ServiceLocationMode | null;
  governorate: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
}

function todayCairo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
}

export async function loadTechnicianServiceLocation(
  client: DbQueryable,
  technicianId: string,
): Promise<TechnicianServiceLocationRow | null> {
  const { rows } = await client.query<{
    governorate: string | null;
    area: string | null;
    registered_lat: number | null;
    registered_lon: number | null;
    active_lat: number | null;
    active_lon: number | null;
    previous_active_lat: number | null;
    previous_active_lon: number | null;
    last_work_lat: number | null;
    last_work_lon: number | null;
    service_location_mode: string | null;
    service_location_day: string | null;
  }>(
    `SELECT
       governorate,
       area,
       ST_Y(location::geometry) AS registered_lat,
       ST_X(location::geometry) AS registered_lon,
       ST_Y(active_location::geometry) AS active_lat,
       ST_X(active_location::geometry) AS active_lon,
       ST_Y(previous_active_location::geometry) AS previous_active_lat,
       ST_X(previous_active_location::geometry) AS previous_active_lon,
       ST_Y(last_work_location::geometry) AS last_work_lat,
       ST_X(last_work_location::geometry) AS last_work_lon,
       service_location_mode,
       service_location_day::text AS service_location_day
     FROM users
     WHERE id = $1 AND role = 'technician'
     LIMIT 1`,
    [technicianId],
  );
  const row = rows[0];
  if (!row) return null;
  const mode = row.service_location_mode;
  const parsedMode =
    mode === "registered" || mode === "last_work" || mode === "current" ? mode : null;
  return {
    governorate: row.governorate,
    area: row.area,
    registeredLat: row.registered_lat,
    registeredLon: row.registered_lon,
    activeLat: row.active_lat,
    activeLon: row.active_lon,
    previousActiveLat: row.previous_active_lat,
    previousActiveLon: row.previous_active_lon,
    lastWorkLat: row.last_work_lat,
    lastWorkLon: row.last_work_lon,
    serviceLocationMode: parsedMode,
    serviceLocationDay: row.service_location_day,
  };
}

export function needsDailyServiceLocationPrompt(row: TechnicianServiceLocationRow): boolean {
  const today = todayCairo();
  return row.serviceLocationDay !== today || !row.serviceLocationMode;
}

export function resolveTechnicianServiceLocation(row: TechnicianServiceLocationRow): ResolvedServiceLocation {
  const mode = row.serviceLocationMode;
  if (mode === "registered") {
    return {
      mode,
      governorate: row.governorate,
      area: row.area,
      latitude: row.registeredLat,
      longitude: row.registeredLon,
    };
  }
  if (mode === "last_work" && row.lastWorkLat != null && row.lastWorkLon != null) {
    return {
      mode,
      governorate: row.governorate,
      area: row.area,
      latitude: row.lastWorkLat,
      longitude: row.lastWorkLon,
    };
  }
  if (mode === "current" && row.activeLat != null && row.activeLon != null) {
    return {
      mode,
      governorate: row.governorate,
      area: row.area,
      latitude: row.activeLat,
      longitude: row.activeLon,
    };
  }
  return {
    mode: null,
    governorate: row.governorate,
    area: row.area,
    latitude: row.registeredLat ?? row.activeLat,
    longitude: row.registeredLon ?? row.activeLon,
  };
}

export async function setTechnicianServiceLocation(
  client: DbQueryable,
  technicianId: string,
  mode: ServiceLocationMode,
  currentCoords?: { latitude: number; longitude: number },
): Promise<void> {
  const today = todayCairo();
  const row = await loadTechnicianServiceLocation(client, technicianId);
  if (!row) throw new Error("TECH_NOT_FOUND");

  if (row.serviceLocationDay && row.serviceLocationDay !== today && row.activeLat != null && row.activeLon != null) {
    await client.query(
      `UPDATE users
       SET previous_active_location = active_location
       WHERE id = $1`,
      [technicianId],
    );
  }

  if (mode === "current") {
    if (!currentCoords) throw new Error("CURRENT_COORDS_REQUIRED");
    await client.query(
      `UPDATE users
       SET service_location_mode = $2,
           service_location_day = $3::date,
           active_location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
           updated_at = now()
       WHERE id = $1`,
      [technicianId, mode, today, currentCoords.longitude, currentCoords.latitude],
    );
    return;
  }

  if (mode === "registered") {
    await client.query(
      `UPDATE users
       SET service_location_mode = $2,
           service_location_day = $3::date,
           active_location = location,
           updated_at = now()
       WHERE id = $1`,
      [technicianId, mode, today],
    );
    return;
  }

  await client.query(
    `UPDATE users
     SET service_location_mode = $2,
         service_location_day = $3::date,
         active_location = last_work_location,
         updated_at = now()
     WHERE id = $1`,
    [technicianId, mode, today],
  );
}

export async function recordLastWorkLocation(
  client: DbQueryable,
  technicianId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await client.query(
    `UPDATE users
     SET last_work_location = ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
         updated_at = now()
     WHERE id = $1`,
    [technicianId, longitude, latitude],
  );
}

/** Apply resolved daily service location to in-memory WS routing metadata. */
export function applyResolvedServiceLocationToRouting(
  meta: {
    governorate?: string;
    area?: string;
    serviceLocationMode?: ServiceLocationMode | null;
    serviceLat?: number;
    serviceLon?: number;
  },
  resolved: ResolvedServiceLocation,
): void {
  if (resolved.governorate) {
    meta.governorate = resolved.governorate.trim().toLowerCase();
  }
  if (resolved.area) {
    meta.area = resolved.area.trim().toLowerCase();
  }
  meta.serviceLocationMode = resolved.mode;
  if (resolved.latitude != null && resolved.longitude != null) {
    meta.serviceLat = resolved.latitude;
    meta.serviceLon = resolved.longitude;
  }
}

export async function hydrateTechnicianRoutingMeta(
  technicianId: string,
  meta: {
    governorate?: string;
    area?: string;
    serviceLocationMode?: ServiceLocationMode | null;
    serviceLat?: number;
    serviceLon?: number;
  },
): Promise<void> {
  const client = await pool.connect();
  try {
    const row = await loadTechnicianServiceLocation(client, technicianId);
    if (!row) return;
    applyResolvedServiceLocationToRouting(meta, resolveTechnicianServiceLocation(row));
  } finally {
    client.release();
  }
}
