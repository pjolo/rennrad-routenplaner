// ============================================
// KONFIGURATION
// ============================================

const CONFIG = {
    // OpenRouteService API Key - Kostenlos registrieren:
    // https://openrouteservice.org/dev/#/signup
    ORS_API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImJjMzNkYjk2YmZjZTQ3YTlhMDlkZWI2ZThiZjQ5ZTdlIiwiaCI6Im11cm11cjY0In0=',

    // Nominatim (OpenStreetMap) für Geocoding - kein Key nötig
    NOMINATIM_URL: 'https://nominatim.openstreetmap.org',

    // OpenRouteService
    ORS_URL: 'https://api.openrouteservice.org',

    // Open Elevation API (kostenlos, kein Key nötig)
    ELEVATION_URL: 'https://api.open-elevation.com/api/v1',

    // Karten-Tile-Server
    TILE_URL: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',

    // Standardwerte
    DEFAULT_CENTER: [47.3769, 8.5417], // Zürich
    DEFAULT_ZOOM: 11,

    // Routenfarben
    ROUTE_COLORS: ['#e63946', '#457b9d', '#f4a261'],
    ROUTE_COLORS_DIM: ['rgba(230,57,70,0.3)', 'rgba(69,123,157,0.3)', 'rgba(244,162,97,0.3)'],

    // Anzahl Routenvorschläge
    NUM_ROUTES: 3,

    // Verzögerung zwischen API-Calls (Rate Limiting)
    API_DELAY: 1500,
};

