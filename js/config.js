// ============================================
// KONFIGURATION
// ============================================

const CONFIG = {
    // Hier deinen OpenRouteService API-Key eintragen
    // Kostenlos holen: https://openrouteservice.org/dev/#/signup
    ORS_API_KEY: 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImJjMzNkYjk2YmZjZTQ3YTlhMDlkZWI2ZThiZjQ5ZTdlIiwiaCI6Im11cm11cjY0In0=',

    // API URLs
    ORS_URL: 'https://api.openrouteservice.org',
    NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
    ELEVATION_URL: 'https://api.open-elevation.com/api/v1',

    // Karten-Tiles (Dark Theme)
    TILE_URL: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',

    // Standard-Kartenansicht (Zürich)
    DEFAULT_CENTER: [47.37, 8.54],
    DEFAULT_ZOOM: 10,

    // Routen
    NUM_ROUTES: 3,
    API_DELAY: 1200,
    ROUTE_COLORS: ['#e63946', '#2a9d8f', '#e9c46a'],
    ROUTE_NAMES: ['Route A', 'Route B', 'Route C'],
    ELEVATION_SAMPLE_POINTS: 100
};
