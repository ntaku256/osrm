"use client";
import { useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

export default function WalkPage() {
  const [recording, setRecording] = useState(false);
  const [tracePoints, setTracePoints] = useState<[number, number][]>([]);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const watchIdRef = useRef<number | null>(null);

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
          setTracePoints((prev) => [...prev, [pos.coords.latitude, pos.coords.longitude]]);
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
        setError("保存に失敗しました");
      }
    } catch (e: any) {
      setError("通信エラー: " + e.message);
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">GPS移動記録</h2>
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
    </main>
  );
} 