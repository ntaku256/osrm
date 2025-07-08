"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import type { Shelter } from "@/types/shelter";
import { routeApi } from "@/utils/api";
import { useBackendUser } from "@/hooks/useBackendUser";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

export default function EvacuationSimulationPage() {
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [nearestShelter, setNearestShelter] = useState<Shelter | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user } = useBackendUser();

  // 1. 現在地取得
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("このブラウザはGPSに対応していません");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        setError("現在地の取得に失敗: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // 2. 避難所リスト取得
  useEffect(() => {
    apiFetch("/shelters").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        setShelters(data.items || []);
      }
    });
  }, []);

  // 3. 最寄り避難所選択
  useEffect(() => {
    if (!currentPos || shelters.length === 0) return;
    let minDist = Infinity;
    let nearest: Shelter | null = null;
    shelters.forEach((s) => {
      const d = Math.sqrt(
        Math.pow(currentPos[0] - s.lat, 2) + Math.pow(currentPos[1] - s.lon, 2)
      );
      if (d < minDist) {
        minDist = d;
        nearest = s;
      }
    });
    setNearestShelter(nearest);
  }, [currentPos, shelters]);

  // 4. ルート検索（dangerLevel回避ロジック付き）
  useEffect(() => {
    if (!currentPos || !nearestShelter || !user) return;
    setLoading(true);
    setError("");
    let attempts = 0;
    let excludeLocations: { lat: number; lon: number }[] = [];
    let bestRoute: any = null;
    let bestDangerSum = Infinity;

    const search = async () => {
      attempts++;
      const res = await routeApi.getRouteWithObstacles({
        locations: [
          { lat: currentPos[0], lon: currentPos[1] },
          { lat: nearestShelter.lat, lon: nearestShelter.lon }
        ],
        costing: "pedestrian",
        language: "ja-JP",
        exclude_locations: excludeLocations.length > 0 ? excludeLocations : undefined,
      });
      if (res.data) {
        const obstacles = res.data.trip?.obstacles || [];
        const highDanger = obstacles.filter(
          (o: any) => o.dangerLevel > user.evacuation_level
        );
        // dangerLevel合計
        const dangerSum = obstacles.reduce((sum: number, o: any) => sum + (o.dangerLevel || 0), 0);
        if (dangerSum < bestDangerSum) {
          bestDangerSum = dangerSum;
          bestRoute = res.data;
        }
        if (highDanger.length > 0 && attempts < 3) {
          // 高危険障害物を回避して再検索
          excludeLocations.push(...highDanger.map((o: any) => ({ lat: o.position[0], lon: o.position[1] })));
          search();
        } else {
          setRouteData(bestRoute);
          if (highDanger.length > 0) {
            setError("安全なルートが見つかりませんでした。一番安全な道を表示します。");
          }
          setLoading(false);
        }
      } else {
        setError(res.error || "ルート取得失敗");
        setLoading(false);
      }
    };
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPos, nearestShelter, user]);

  // ナビ用: 現在地をwatchPositionで定期更新
  useEffect(() => {
    if (!navigator.geolocation) return;
    let watchId: number | null = null;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // ナビ用: 進行方向ガイド（次の経路点までの距離・方角）
  const [nextInfo, setNextInfo] = useState<{ dist: number; bearing: number } | null>(null);
  useEffect(() => {
    if (!routeData || !currentPos) return;
    // shapeをデコードして最も近い点を探す
    const decodePolyline = (encoded: string): [number, number][] => {
      // 簡易デコード（utils/polyline参照）
      // ここでは既存のdecodePolyline関数を使う想定
      try {
        const { decodePolyline } = require("@/utils/polyline");
        return decodePolyline(encoded);
      } catch {
        return [];
      }
    };
    const shape = routeData.trip?.legs?.[0]?.shape;
    if (!shape) return;
    const points: [number, number][] = decodePolyline(shape);
    if (points.length === 0) return;
    // 現在地から最も近いshape上の点を探す
    let minDist = Infinity, minIdx = 0;
    points.forEach((p, i) => {
      const d = Math.sqrt(Math.pow(currentPos[0] - p[0], 2) + Math.pow(currentPos[1] - p[1], 2));
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    });
    // 次の経路点
    const nextIdx = Math.min(minIdx + 1, points.length - 1);
    const next = points[nextIdx];
    // 距離と方角
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const lat1 = toRad(currentPos[0]), lon1 = toRad(currentPos[1]);
    const lat2 = toRad(next[0]), lon2 = toRad(next[1]);
    const dLat = lat2 - lat1, dLon = lon2 - lon1;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const R = 6371; // km
    const dist = R * c * 1000; // m
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
    setNextInfo({ dist, bearing });
  }, [routeData, currentPos]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">避難シミュレーション</h2>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      <div className="mb-2">現在地: {currentPos ? `${currentPos[0]}, ${currentPos[1]}` : "取得中..."}</div>
      <div className="mb-2">最寄り避難所: {nearestShelter ? nearestShelter.name : "検索中..."}</div>
      <div className="w-full max-w-xl h-96 mb-4">
        <RouteMap
          routeData={routeData}
          isLoading={loading}
          startPosition={currentPos}
          endPosition={nearestShelter ? [nearestShelter.lat, nearestShelter.lon] : null}
          onMapClick={() => {}}
          height="384px"
          currentPosition={currentPos}
        />
      </div>
      {/* ナビ進行方向ガイド */}
      {nextInfo && (
        <div className="mb-4 text-center text-blue-700 font-bold">
          次の経路点まで: {nextInfo.dist.toFixed(0)}m / 方角: {nextInfo.bearing.toFixed(0)}°
        </div>
      )}
    </main>
  );
} 