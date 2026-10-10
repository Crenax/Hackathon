These offline browser assets come from map/viewer/{data,routing,location}.js.
map.json is sample-data.js with the globalThis.ARCGIS_SAMPLE= wrapper removed.
They are served from the frontend so Vite and Docker work without a separate map server.
After viewer engine or capture changes, refresh these copies together. Routing is covered by map/tests.
