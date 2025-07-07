"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import type { Shelter, ShelterListResponse } from "@/types/shelter";

const ShelterMap = dynamic(() => import("./ShelterMap"), { ssr: false });

// 地図用Shelter型
interface MapShelter {
  id: number;
  name: string;
  lat: number;
  lng: number;
  elevation: number;
  safety_level: number;
  address: string;
}

export default function ShelterMapContainer() {
  const [shelters, setShelters] = useState<MapShelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch("/shelters")
      .then(async (res) => {
        if (res.ok) {
          const data: ShelterListResponse = await res.json();
          if (Array.isArray(data.items)) {
            setShelters(
              data.items.map((item) => ({
                id: item.id,
                name: item.name,
                lat: item.lat,
                lng: item.lon, // lon→lng
                elevation: item.elevation,
                safety_level: item.tsunami_safety_level, // tsunami_safety_level→safety_level
                address: item.address,
              }))
            );
          } else {
            setShelters([]);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full h-[600px] mb-4">
        <ShelterMap shelters={shelters} selectedId={selectedId} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-2 py-1">名前</th>
              <th className="border px-2 py-1">標高(m)</th>
              <th className="border px-2 py-1">安全レベル</th>
            </tr>
          </thead>
          <tbody>
            {shelters.map((shelter) => (
              <tr
                key={shelter.id}
                className={selectedId === shelter.id ? "bg-blue-300" : ""}
                onClick={() => setSelectedId(shelter.id)}
                style={{ cursor: "pointer" }}
              >
                <td className="border px-2 py-1">{shelter.name}</td>
                <td className="border px-2 py-1">{shelter.elevation}</td>
                <td className="border px-2 py-1">
                  <span
                    className={
                      shelter.safety_level === 1
                        ? "inline-block px-2 py-1 rounded bg-blue-500 text-white text-xs font-bold"
                        : shelter.safety_level === 2
                        ? "inline-block px-2 py-1 rounded bg-green-400 text-white text-xs font-bold"
                        : shelter.safety_level === 3
                        ? "inline-block px-2 py-1 rounded bg-green-700 text-white text-xs font-bold"
                        : "inline-block px-2 py-1 rounded bg-gray-300 text-black text-xs font-bold"
                    }
                  >
                    {shelter.safety_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div>Loading...</div>}
    </div>
  );
} 