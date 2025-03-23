import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";




mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;

const HexMap = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const hasZoomed = useRef(false); // ✅ moved here

  const [geoData, setGeoData] = useState(null);
  const [selectedHexes, setSelectedHexes] = useState([]);
  const [resolution, setResolution] = useState(8);

  const resolutionForZoom = (zoom) => {
    console.log("🔍 Calculating resolution for zoom:", zoom);
    if (zoom >= 12.5) return 10;
    if (zoom >= 11.5) return 9;
    if (zoom >= 10) return 8;
    if (zoom >= 9) return 7;
    return 6;
  };

  const fetchHexes = (res) => {
    fetch(`http://localhost:5001/api/map/h3-soc?file=test.csv&resolution=${res}`)
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        console.log("Fetched GeoJSON with resolution:", res);
      });
  };

  // Initial fetch on resolution
  useEffect(() => {
    fetchHexes(resolution);
  }, [resolution]);

  // Map + Draw init
  useEffect(() => {
    if (map.current || !geoData) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v10",
      center: [77.30748, 28.704],
      zoom: 8,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: "draw_polygon",
    });

    map.current.addControl(draw, "top-left");

    const updateSelection = (e) => {
      const polygon = e.features[0];
      const selection = turf.polygon(polygon.geometry.coordinates);

      const selected = geoData.features.filter((feature) =>
        turf.booleanIntersects(selection, feature)
      );

      console.log("✅ Selected Hexes:", selected.length);
      setSelectedHexes(selected);
    };

    map.current.on("draw.create", updateSelection);
    map.current.on("draw.update", updateSelection);

    map.current.on("draw.delete", () => {
      setSelectedHexes([]); // ✅ Clear summary on delete
      console.log("🧹 Selection cleared.");
    });

    map.current.on("load", () => {
      map.current.addSource("h3-hexes", {
        type: "geojson",
        data: geoData,
      });

      map.current.addLayer({
        id: "h3-hex-layer",
        type: "fill",
        source: "h3-hexes",
        paint: {
          "fill-color": ["get", "soc_color"],
          "fill-opacity": 0.6,
          "fill-outline-color": "#333",
        },
      });

      map.current.addLayer({
        id: "h3-hex-borders",
        type: "line",
        source: "h3-hexes",
        paint: {
          "line-color": "#000",
          "line-width": 0.8,
        },
      });

      map.current.on("click", "h3-hex-layer", (e) => {
        const props = e.features[0].properties;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <strong>Hex ID:</strong> ${props.h3_index}<br/>
            <strong>Avg SOC:</strong> ${Number(props.avg_soc).toFixed(1)}%<br/>
            <strong>Min SOC:</strong> ${Number(props.min_soc).toFixed(1)}%<br/>
            <strong>Max SOC:</strong> ${Number(props.max_soc).toFixed(1)}%<br/>
            <strong>Assets:</strong> ${props.count}
          `)
          .addTo(map.current);
      });

      const bounds = new mapboxgl.LngLatBounds();
      geoData.features.forEach((feature) => {
        feature.geometry.coordinates[0].forEach(([lng, lat]) => {
          bounds.extend([lng, lat]);
        });
      });

      if (!bounds.isEmpty()) {
        map.current.fitBounds(bounds, { padding: 50 });
      }
    });

    map.current.on("zoomend", () => {
      const currentZoom = map.current.getZoom();
      const newResolution = resolutionForZoom(currentZoom);

      if (!hasZoomed.current) {
        hasZoomed.current = true;
        console.log("⚠️ Skipping first zoomend resolution update.");
        return;
      }

      if (newResolution !== resolution) {
        console.log("📐 Zoom changed → updating resolution:", newResolution);
        setResolution(newResolution);
      } else {
        fetchHexes(resolution);
      }
    });
  }, [geoData, resolution]);

  // Update source with new GeoJSON
  useEffect(() => {
    if (!map.current || !geoData) return;

    const source = map.current.getSource("h3-hexes");
    if (source) {
      source.setData(geoData);
    }
  }, [geoData]);

  // Compute summary stats
  const getSummaryStats = () => {
    const count = selectedHexes.length;
    const totalAssets = selectedHexes.reduce((sum, f) => sum + f.properties.count, 0);
    const avgSOC =
      selectedHexes.reduce((sum, f) => sum + f.properties.avg_soc, 0) / count || 0;
    const minSOC = Math.min(...selectedHexes.map((f) => f.properties.min_soc));
    const maxSOC = Math.max(...selectedHexes.map((f) => f.properties.max_soc));
  
    // ✅ Compute total area using Turf
    const totalAreaSqKm = selectedHexes.reduce((sum, feature) => {
      const area = turf.area(feature); // in square meters
      return sum + area;
    }, 0) / 1_000_000; // convert to sq.km
  
    return { count, totalAssets, avgSOC, minSOC, maxSOC, totalAreaSqKm };
  };

  return (
    <div style={{ position: "relative", height: "100vh", width: "100%" }}>
      <div ref={mapContainer} style={{ height: "100%", width: "100%" }} />
  
      {selectedHexes.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "white",
            padding: "1.5rem",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10,
            width: "280px",
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
          }}
        >
          <h3 style={{ marginBottom: "1rem", fontWeight: "600", fontSize: "1.25rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>
           Battery Status
          </h3>
  
          {(() => {
            const { totalAssets, avgSOC, minSOC, maxSOC, totalAreaSqKm } = getSummaryStats();
            return (
              <>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ fontSize: "14px", color: "#666" }}>Avg SOC</label>
                  <div
                    style={{
                      background: "#f0f0f0",
                      height: "16px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      marginTop: "4px",
                    }}
                  >
                    <div
                      style={{
                        width: `${avgSOC}%`,
                        background: "#00b894",
                        height: "100%",
                        transition: "width 0.3s ease",
                      }}
                    ></div>
                  </div>
                  <div style={{ fontSize: "13px", marginTop: "4px", color: "#444" }}>
                    {avgSOC.toFixed(1)}%
                  </div>
                </div>
                <div style={{ fontSize: "14px", lineHeight: "1.6", color: "#333" }}>
                  <p><strong>Total Assets:</strong> {totalAssets}</p>
                  <p><strong>Area Selected:</strong> {totalAreaSqKm.toFixed(2)} km²</p>
                  <p><strong>Min SOC:</strong> {minSOC.toFixed(1)}%</p>
                  <p><strong>Max SOC:</strong> {maxSOC.toFixed(1)}%</p>

                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );  
};

export default HexMap;
