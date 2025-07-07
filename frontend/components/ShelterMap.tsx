"use client";
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  elevation: number;
  safety_level: number;
  address: string;
}

interface ShelterMapProps {
  shelters: MapShelter[];
  selectedId: number | null;
}

export default function ShelterMap({ shelters, selectedId }: ShelterMapProps) {
  const markerRefs = useRef<{ [id: number]: L.Marker } | null>({});
  const [zoom, setZoom] = useState(16);

  function FlyToSelected() {
    const map = useMap();
    useEffect(() => {
      if (selectedId != null) {
        const shelter = shelters.find((s) => s.id === selectedId);
        if (shelter) {
          map.flyTo([shelter.lat, shelter.lng], 18, { duration: 0.5 });
          // ポップアップを開く
          const marker = markerRefs.current?.[shelter.id];
          if (marker) marker.openPopup();
        }
      }
    }, [selectedId, shelters, map]);
    return null;
  }

  // ズーム変更を地図に反映
  function ZoomSync() {
    const map = useMap();
    useEffect(() => {
      map.setZoom(zoom);
    }, [zoom, map]);
    useEffect(() => {
      const onZoom = () => setZoom(map.getZoom());
      map.on("zoomend", onZoom);
      return () => { map.off("zoomend", onZoom); };
    }, [map]);
    return null;
  }

  return (
    <div className="relative z-0">
      <MapContainer
        center={[33.881292, 135.157809]}
        zoom={zoom}
        zoomControl={false}
        scrollWheelZoom={false}
        style={{ height: "600px", width: "100%" }}
      >
        <TileLayer
          url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://maps.gsi.go.jp/development/ichiran.html'>国土地理院</a>"
        />
        {shelters.map((shelter) => (
          <Marker
            key={shelter.id}
            position={[shelter.lat, shelter.lng]}
            ref={(ref) => {
              if (ref) markerRefs.current![shelter.id] = ref;
            }}
            icon={L.divIcon({
              className: "custom-shelter-marker",
              html: `
                <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
                  <img src='https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png' style='width:32px;height:32px;display:block;' />
                  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;border:3px solid #fff;${
                    shelter.safety_level === 1
                      ? 'background:#3b82f6;'
                      : shelter.safety_level === 2
                      ? 'background:#4ade80;'
                      : shelter.safety_level === 3
                      ? 'background:#166534;'
                      : 'background:#e5e7eb;'
                  }${selectedId === shelter.id ? ';box-shadow:0 0 0 4px #fff,0 0 12px 4px #2563eb;' : ''}"></div>
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
              popupAnchor: [0, -32],
            })}
          >
            <Popup>
              <div>
                <div><b>{shelter.name}</b></div>
                <div>標高: {shelter.elevation} m</div>
                <div>
                  安全レベル: <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background:
                        shelter.safety_level === 1
                          ? '#3b82f6'
                          : shelter.safety_level === 2
                          ? '#4ade80'
                          : shelter.safety_level === 3
                          ? '#166534'
                          : '#e5e7eb',
                      color: '#fff',
                    }}
                  >
                    {shelter.safety_level}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        <FlyToSelected />
        <ZoomSync />
      </MapContainer>
      <div className="flex items-center gap-2 mt-2">
        <span>ズーム</span>
        <input
          type="range"
          min={5}
          max={18}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          onWheel={e => {
            e.preventDefault(); // スクロールによるズーム変更を無効化
          }}
          className="w-48"
          style={{ touchAction: "none" }}
        />
        <span>{zoom}</span>
      </div>
    </div>
  );
} 