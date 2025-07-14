"use client";
import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
import { useBackendUser } from "@/hooks/useBackendUser";
import { useEffect } from "react";
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

export default function WalkPage() {
  const { user, loading: userLoading } = useBackendUser();
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
  const [recording, setRecording] = useState(false);
  const [tracePoints, setTracePoints] = useState<[number, number][]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const watchIdRef = useRef<number | null>(null);

  // 直前の点と10m未満なら追加しない距離計算関数
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const calcDistance = (a: [number, number], b: [number, number]) => {
    const R = 6371000; // 地球半径[m]
    const dLat = toRad(b[0] - a[0]);
    const dLon = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const aVal = Math.sin(dLat/2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  };

  // 記録開始
  const startRecording = () => {
    setTracePoints([]);
    setResult(null);
    setError("");
    setStartTime(new Date().toISOString());
    setEndTime(null);
    setRecording(true);
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setTracePoints((prev) => {
            const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            if (prev.length === 0) return [next];
            const last = prev[prev.length - 1];
            if (calcDistance(last, next) < 50) return prev; // 50m未満なら追加しない
            return [...prev, next];
          });
        },
        (err) => {
          setError("位置情報の取得に失敗しました: " + err.message);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else {
      setError("このブラウザはGPSに対応していません");
    }
  };

  // 記録停止
  const stopRecording = () => {
    setRecording(false);
    setEndTime(new Date().toISOString());
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // サーバーに保存
  const saveRoute = async () => {
    setError("");
    setResult(null);
    if (!startTime || !endTime || tracePoints.length < 2) {
      setError("十分なデータがありません");
      return;
    }
    try {
      const res = await apiFetch("/walked_routes", {
        method: "POST",
        body: JSON.stringify({
          trace_points: tracePoints,
          start_time: startTime,
          end_time: endTime,
          title: "新しい移動記録"
        })
      });
      if (res.ok) {
        setResult(await res.json());
      } else {
        setError("保存に失敗しました: " + res.body);
      }
    } catch (e: any) {
      setError("通信エラー: " + e.message);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">GPS移動記録</h2>
      {userLoading && <div>認証確認中...</div>}
      {!user && !userLoading && (
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
          <div className="flex gap-4 mb-4">
            {!recording ? (
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={startRecording}>記録開始</button>
            ) : (
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={stopRecording}>記録停止</button>
            )}
            <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={saveRoute} disabled={recording || tracePoints.length < 2}>保存</button>
          </div>
          <div className="mb-2">記録点数: {tracePoints.length}</div>
          {/* 地図表示: 記録中の軌跡を表示 */}
          <div className="w-full max-w-xl h-96 mb-4">
            <RouteMap
              routeData={null}
              isLoading={false}
              startPosition={tracePoints[0] || null}
              endPosition={tracePoints[tracePoints.length - 1] || null}
              onMapClick={() => {}}
              trackPoints={tracePoints}
              isRecording={recording}
              height="384px"
            />
          </div>
          {error && <div className="text-red-500 mb-2">{error}</div>}
          {result && (
            <div className="bg-gray-100 p-4 rounded mt-4 w-full max-w-xl">
              <h3 className="font-bold mb-2">保存結果</h3>
              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </>
      )}
    </main>
  );
} 