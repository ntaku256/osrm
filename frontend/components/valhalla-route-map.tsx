"use client"

import { useEffect, useRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// polylineデコード関数（Google Polylineアルゴリズム）
function decodePolyline(str: string): [number, number][] {
    let index = 0, lat = 0, lng = 0, coordinates: [number, number][] = []
    while (index < str.length) {
        let b, shift = 0, result = 0
        do {
            b = str.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
        lat += dlat
        shift = 0
        result = 0
        do {
            b = str.charCodeAt(index++) - 63
            result |= (b & 0x1f) << shift
            shift += 5
        } while (b >= 0x20)
        const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
        lng += dlng
        coordinates.push([lat / 1e6, lng / 1e6])
    }
    return coordinates
}

const routeColors = [
    "#0074D9", // 青
    "#FF4136", // 赤
    "#2ECC40", // 緑
    "#B10DC9", // 紫
    "#FF851B", // オレンジ
    "#7FDBFF", // 水色
    "#F012BE", // ピンク
    "#3D9970", // ダークグリーン
    "#FFDC00", // 黄色
    "#AAAAAA", // グレー
];

export default function ValhallaRouteMap() {
    // 出発地・目的地
    const [points, setPoints] = useState<[number, number][]>([])
    // 複数ルート候補
    const [routes, setRoutes] = useState<[number, number][][]>([])
    const [selectedRouteIndex, setSelectedRouteIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const mapRef = useRef<L.Map | null>(null)
    const markersRef = useRef<L.LayerGroup | null>(null)
    const routeLayerRef = useRef<L.Polyline[]>([])
    const mapContainerRef = useRef<HTMLDivElement>(null)

    // 地図初期化
    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return
        const map = L.map(mapContainerRef.current, {
            center: [33.881292, 135.157809],
            zoom: 15,
            zoomControl: true,
        })
        L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
            attribution: '地図データ：<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>',
            maxZoom: 18,
            minZoom: 5,
        }).addTo(map)
        markersRef.current = L.layerGroup().addTo(map)
        mapRef.current = map

        map.on("click", (e: L.LeafletMouseEvent) => {
            if (points.length >= 2) return
            const { lat, lng } = e.latlng
            setPoints(prev => [...prev, [lat, lng]])
        })

        setTimeout(() => {
            map.invalidateSize()
        }, 100)

        return () => {
            map.off()
            map.remove()
            mapRef.current = null
        }
    }, [mapContainerRef])

    // マーカー表示
    useEffect(() => {
        if (!mapRef.current || !markersRef.current) return
        markersRef.current.clearLayers()
        points.forEach((pt, idx) => {
            L.marker(pt, {
                title: idx === 0 ? "出発地" : "目的地",
                icon: L.divIcon({
                    className: "custom-marker",
                    html: `<div class='w-6 h-6 rounded-full flex items-center justify-center text-white ${idx === 0 ? 'bg-blue-600' : 'bg-green-600'} border-2 border-white'>${idx === 0 ? 'S' : 'G'}</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                })
            }).addTo(markersRef.current!)
        })
    }, [points])

    // 経路描画
    useEffect(() => {
        if (!mapRef.current) return;
        // 既存のルートレイヤーを全て削除
        if (routeLayerRef.current && Array.isArray(routeLayerRef.current)) {
            routeLayerRef.current.forEach((layer) => layer.remove());
        }
        routeLayerRef.current = [];
        routes.forEach((route, idx) => {
            const color = routeColors[idx % routeColors.length];
            const isSelected = idx === selectedRouteIndex;
            if (isSelected) {
                // アウトライン（白、太め）
                const outline = L.polyline(route, {
                    color: "#fff",
                    weight: 13,
                    opacity: 0.9,
                    dashArray: undefined,
                }).addTo(mapRef.current!);
                routeLayerRef.current.push(outline);
                // 本体（本来の色、太め）
                const polyline = L.polyline(route, {
                    color,
                    weight: 7,
                    opacity: 0.95,
                    dashArray: '8,6',
                }).addTo(mapRef.current!);
                routeLayerRef.current.push(polyline);
                mapRef.current!.fitBounds(L.latLngBounds(route));
            } else {
                // 選択外ルート（やや濃いめ）
                const polyline = L.polyline(route, {
                    color,
                    weight: 5,
                    opacity: 0.5,
                    dashArray: undefined,
                }).addTo(mapRef.current!);
                routeLayerRef.current.push(polyline);
            }
        });
    }, [routes, selectedRouteIndex]);

    // 2点選択時にValhalla APIリクエスト
    useEffect(() => {
        const fetchRoutes = async () => {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch("http://localhost:8080/route", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        locations: [
                            { lat: points[0][0], lon: points[0][1] },
                            { lat: points[1][0], lon: points[1][1] }
                        ],
                        costing: "pedestrian",
                        language: "ja-JP",
                        alternates: 10
                    })
                })
                if (!res.ok) throw new Error("Valhalla APIエラー")
                const data = await res.json()
                // 複数ルート候補をデコード
                const routeCandidates: [number, number][][] = []
                if (data.trip?.legs?.[0]?.shape) {
                    routeCandidates.push(decodePolyline(data.trip.legs[0].shape))
                }
                if (data.alternates && Array.isArray(data.alternates)) {
                    for (const alt of data.alternates) {
                        if (alt.trip?.legs?.[0]?.shape) {
                            routeCandidates.push(decodePolyline(alt.trip.legs[0].shape))
                        }
                    }
                }
                if (routeCandidates.length === 0) throw new Error("経路データが取得できませんでした")
                setRoutes(routeCandidates)
                setSelectedRouteIndex(0)
            } catch (e: any) {
                setError(e.message || "経路取得エラー")
                setRoutes([])
                setSelectedRouteIndex(0)
            } finally {
                setLoading(false)
            }
        }
        if (points.length === 2) {
            fetchRoutes()
        }
    }, [points])

    // クリアボタン
    const handleClear = () => {
        setPoints([])
        setRoutes([])
        setSelectedRouteIndex(0)
        setError(null)
        setLoading(false)
    }

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-md mb-4">
                <div className="text-black">地図上で2点をクリックして経路を検索します。</div>
                <button className="mt-2 px-4 py-2 bg-gray-200 rounded text-black" onClick={handleClear}>クリア</button>
                {loading && <div className="text-blue-600 mt-2">経路検索中...</div>}
                {error && <div className="text-red-600 mt-2">{error}</div>}
                {/* ルート切り替えボタン */}
                {routes.length > 1 && (
                    <div className="flex gap-2 mt-4">
                        {routes.map((_, idx) => (
                            <button
                                key={idx}
                                className={`px-3 py-1 rounded border transition-colors duration-150 ${selectedRouteIndex === idx ? "bg-blue-600 text-white border-blue-600" : "bg-white text-blue-600 border-blue-600 hover:bg-blue-50"}`}
                                onClick={() => setSelectedRouteIndex(idx)}
                            >
                                ルート{idx + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            <div className="relative">
                <div ref={mapContainerRef} className="h-[600px] rounded-lg overflow-hidden relative z-0" />
            </div>
        </div>
    )
} 