"use client"
import dynamic from "next/dynamic"

const ValhallaRouteMap = dynamic(() => import("@/components/valhalla-route-map"), {
    ssr: false,
    loading: () => <div className="h-[600px] bg-gray-100 flex items-center justify-center">地図を読み込み中...</div>,
})

export default function ValhallaRoutePage() {
    return (
        <div className="max-w-5xl mx-auto py-8">
            <h1 className="text-2xl font-bold mb-4">Valhalla 経路検索デモ</h1>
            <ValhallaRouteMap />
        </div>
    )
}
