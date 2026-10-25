export interface Attribution {
  source: string;
  text: string;
  url: string;
}

export interface Address {
  houseNumber?: string;
  street?: string;
  postalCode?: string;
  locality?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  countryCode?: string;
}

export interface Place {
  id: string;
  type: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  address?: Address;
  categories?: string[];
  distanceMeters?: number;
  source: string;
}

export interface Places {
  results: Place[];
  attribution: Attribution[];
}

export interface PlaceResult {
  result: Place;
  attribution: Attribution[];
}

export interface Leg {
  distanceMeters: number;
  durationSeconds: number;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  /** Encoded polyline, with five decimal places unless `geometries` was `polyline6`. Absent for `geojson`. */
  polyline?: string;
  /** The path as GeoJSON, when `geometries` was `geojson`. */
  geometry?: LineString;
  legs: Leg[];
}

export interface LineString {
  type: "LineString";
  /** [longitude, latitude] pairs. */
  coordinates: [number, number][];
}

export interface Routes {
  routes: Route[];
  attribution?: Attribution[];
}

export interface IpLocation {
  ip: string;
  found: boolean;
  continentCode?: string;
  countryCode?: string;
  countryName?: string;
  regionCode?: string;
  regionName?: string;
  city?: string;
  location?: Point;
  source: string;
  attributionUrl: string;
  licenseUrl: string;
  datasetRelease: string;
}

export interface Account {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export interface Point {
  lat: number;
  lon: number;
}

export interface RequestOptions {
  /** Cancels the request, such as one for text that has since changed. */
  signal?: AbortSignal;
}

export interface SearchOptions extends RequestOptions {
  focus?: Point;
  country?: string | string[];
  limit?: number;
  lang?: string;
}

export interface ReverseOptions extends RequestOptions {
  limit?: number;
  lang?: string;
}

export interface NearbyOptions extends RequestOptions {
  category?: string | string[];
  radius?: number;
  limit?: number;
  lang?: string;
}

export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Milliseconds per attempt. */
  timeout?: number;
  /** Retries for 503 and for 429 with too many requests in progress. */
  maxRetries?: number;
}

export class MapricotError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, requestId: string | null) {
    super(message);
    this.name = "MapricotError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

type Params = Record<string, string | number | string[] | Point | undefined>;

export class Mapricot {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeout: number;
  readonly #maxRetries: number;

  constructor(options: ClientOptions) {
    if (!options?.apiKey) throw new Error("Pass apiKey, a Mapricot key.");
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl ?? "https://api.mapricot.com";
    this.#timeout = options.timeout ?? 30_000;
    this.#maxRetries = options.maxRetries ?? 2;
  }

  /** Find addresses and places matching free text. */
  search(q: string, { signal, ...options }: SearchOptions = {}): Promise<Places> {
    return this.#request("GET", "/geocoding/v1/search", { q, ...options }, signal);
  }

  /** Suggest addresses and places as someone types. */
  autocomplete(q: string, { signal, ...options }: SearchOptions = {}): Promise<Places> {
    return this.#request("GET", "/geocoding/v1/autocomplete", { q, ...options }, signal);
  }

  /** Find the address nearest a coordinate, or the area around it. */
  reverse(lat: number, lon: number, { signal, ...options }: ReverseOptions = {}): Promise<Places> {
    return this.#request("GET", "/geocoding/v1/reverse", { lat, lon, ...options }, signal);
  }

  /** List places around a coordinate, optionally by category. */
  nearby(lat: number, lon: number, { signal, ...options }: NearbyOptions = {}): Promise<Places> {
    return this.#request("GET", "/places/v1/nearby", { lat, lon, ...options }, signal);
  }

  /** Look up one place by its Mapricot ID. */
  place(id: string, { signal, ...options }: RequestOptions & { lang?: string } = {}): Promise<PlaceResult> {
    return this.#request("GET", `/places/v1/${encodeURIComponent(id)}`, options, signal);
  }

  /** Find a route through 2 to 20 waypoints. */
  route(
    waypoints: Point[],
    { signal, ...options }: RequestOptions & { mode?: "drive" | "walk" | "bicycle"; geometries?: "polyline" | "polyline6" | "geojson" } = {},
  ): Promise<Routes> {
    return this.#request("POST", "/routing/v1/route", {}, signal, { waypoints, ...options });
  }

  /** Approximate location of a public IP address. */
  ip(address: string, { signal }: RequestOptions = {}): Promise<IpLocation> {
    return this.#request("GET", `/ip-geolocation/v1/${encodeURIComponent(address)}`, {}, signal);
  }

  /** The key's account. Not billed, so it checks a key for free. */
  account({ signal }: RequestOptions = {}): Promise<Account> {
    return this.#request("GET", "/account", {}, signal);
  }

  async #request<T>(method: string, path: string, params: Params, signal?: AbortSignal, body?: object): Promise<T> {
    const url = new URL(path, this.#baseUrl);
    for (const [name, value] of Object.entries(params)) {
      if (value === undefined) continue;
      url.searchParams.set(name, format(value));
    }
    const headers: Record<string, string> = { Authorization: `Bearer ${this.#apiKey}` };
    if (body) headers["Content-Type"] = "application/json";

    for (let attempt = 0; ; attempt++) {
      if (signal?.aborted) throw abortReason(signal);
      // AbortSignal.timeout and AbortSignal.any would do this, but are missing from browsers before 2022 and 2024.
      const controller = new AbortController();
      const cancel = () => controller.abort(abortReason(signal!));
      const timer = setTimeout(() => controller.abort(new DOMException("The request timed out.", "TimeoutError")), this.#timeout);
      signal?.addEventListener("abort", cancel);
      let error: MapricotError;
      try {
        const response = await fetch(url, { method, headers, body: body && JSON.stringify(body), signal: controller.signal });
        if (response.ok) return (await response.json()) as T;
        error = await errorFrom(response);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      }

      if (attempt < this.#maxRetries && retryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
      throw error;
    }
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("The request was cancelled.", "AbortError");
}

function format(value: string | number | string[] | Point): string {
  if (Array.isArray(value)) return value.join(",");
  if (typeof value === "object") return `${value.lat},${value.lon}`;
  return String(value);
}

async function errorFrom(response: Response): Promise<MapricotError> {
  const requestId = response.headers.get("X-Request-Id");
  try {
    const { error } = await response.json();
    return new MapricotError(response.status, error.code, error.message, requestId);
  } catch {
    return new MapricotError(response.status, "unknown", `HTTP ${response.status}`, requestId);
  }
}

function retryable(error: MapricotError): boolean {
  return error.status === 503 || error.code === "concurrency_exceeded";
}
