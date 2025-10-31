"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/api";
import type { Shelter } from "@/types/shelter";
import { routeApi } from "@/utils/api";
import { useBackendUser } from "@/hooks/useBackendUser";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

const decodePolyline = (encoded: string): [number, number][] => {
  try {
    const { decodePolyline } = require("@/utils/polyline");
    return decodePolyline(encoded);
  } catch {
    return [];
  }
};

export default function EvacuationSimulationPage() {
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [nearestShelter, setNearestShelter] = useState<Shelter | null>(null);
  const [routeData, setRouteData] = useState<any>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState("");
  const { user, loading } = useBackendUser();
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsAvailable(false);
      setGpsError("このブラウザはGPSに対応していません。");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsAvailable(true);
        setGpsError(null);
      },
      (err) => {
        setGpsAvailable(false);
        if (err.code === 1) setGpsError("位置情報の利用が許可されていません。");
        else if (err.code === 2) setGpsError("位置情報が取得できません。");
        else setGpsError("GPS機能が利用できません。");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // 1. 現在地を常時監視
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("このブラウザはGPSに対応していません");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        setError("現在地の取得に失敗: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // 2~4. 避難所・ルート取得API（初回＋ボタン押下時のみ）
  const fetchRoute = async () => {
    if (!currentPos || !user) return;
    setRouteLoading(true);
    setError("");
    try {
      const res = await apiFetch("/evacuation-route", {
        method: "POST",
        body: JSON.stringify({
          current_pos: { lat: currentPos[0], lon: currentPos[1] },
          evacuation_level: user.evacuation_level,
        }),
      });
      if (!res.ok) throw new Error("避難ルート取得失敗");
      const data = await res.json();
      setNearestShelter(data.nearest_shelter);
      setRouteData(data.route);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRouteLoading(false);
    }
  };

  // 初回のみAPI呼び出し
  useEffect(() => {
    if (!currentPos || !user) return;
    fetchRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ナビ用: maneuversから音声案内テキストを抽出
  const maneuvers: any[] =
    routeData?.trip?.legs?.[0]?.maneuvers ?? [];
  const shape: [number, number][] = routeData?.trip?.legs?.[0]?.shape
    ? decodePolyline(routeData.trip.legs[0].shape)
    : [];

  let nextInstruction = "";
  if (currentPos && maneuvers.length > 0 && shape.length > 0) {
    // 現在地に最も近いshape indexを探す
    let minDist = Infinity, minIdx = 0;
    shape.forEach((p, i) => {
      const d = Math.sqrt(Math.pow(currentPos[0] - p[0], 2) + Math.pow(currentPos[1] - p[1], 2));
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    });
    // そのshape indexを含むmaneuverを探す
    const maneuver = maneuvers.find(
      m => minIdx >= m.begin_shape_index && minIdx <= m.end_shape_index
    );
    if (maneuver) {
      nextInstruction =
        maneuver.verbal_post_transition_instruction ||
        maneuver.verbal_pre_transition_instruction ||
        maneuver.instruction;
    }
  }

  let highlightSegment: [number, number][] = [];
  if (currentPos && maneuvers.length > 0 && shape.length > 0) {
    let minDist = Infinity, minIdx = 0;
    shape.forEach((p, i) => {
      const d = Math.sqrt(Math.pow(currentPos[0] - p[0], 2) + Math.pow(currentPos[1] - p[1], 2));
      if (d < minDist) {
        minDist = d;
        minIdx = i;
      }
    });
    const maneuver = maneuvers.find(
      m => minIdx >= m.begin_shape_index && minIdx <= m.end_shape_index
    );
    if (maneuver) {
      highlightSegment = shape.slice(maneuver.begin_shape_index, maneuver.end_shape_index + 1);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">避難シミュレーション</h2>
      {loading && <div>認証確認中...</div>}
      {!user && !loading && (
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          <h2 className="font-bold mb-2">アクセス権限がありません</h2>
          <p>このページはログインが必要です。</p>
          <a href="/auth" className="text-blue-500 underline">ログインページへ</a>
        </div>
      )}
      {user && !gpsAvailable && (
        <div className="bg-yellow-100 text-yellow-700 p-4 rounded mb-4">
          <h2 className="font-bold mb-2">GPS機能が必要です</h2>
          <p>{gpsError || "このページは位置情報（GPS）機能が必要です。対応ブラウザでアクセスしてください。"}</p>
        </div>
      )}
      {user && gpsAvailable && (
        <>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          <div className="mb-2">現在地: {currentPos ? `${currentPos[0]}, ${currentPos[1]}` : "取得中..."}</div>
          <div className="mb-2">最寄り避難所: {nearestShelter ? nearestShelter.name : "検索中..."}</div>
          <button
            className="mb-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={fetchRoute}
            disabled={routeLoading || !currentPos || !user}
          >
            ナビ更新
          </button>
          <div className="w-full max-w-xl h-96 mb-4">
            <RouteMap
              routeData={routeData}
              isLoading={routeLoading}
              startPosition={currentPos}
              endPosition={nearestShelter ? [nearestShelter.lat, nearestShelter.lon] : null}
              onMapClick={() => {}}
              height="384px"
              currentPosition={currentPos}
              highlightSegment={highlightSegment}
            />
          </div>
          {/* ナビ案内（次の1件だけ） */}
          <div className="mb-4 w-full max-w-xl">
            <h3 className="font-bold mb-2">ナビ案内</h3>
            <div className="text-lg">{nextInstruction || "ルート上にいません"}</div>
          </div>
        </>
      )}
    </main>
  );
} 