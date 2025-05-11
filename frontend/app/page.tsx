import type { Metadata } from "next"
import ObstacleMapContainer from "@/components/obstacle-map-container"

export const metadata: Metadata = {
  title: "OSMR 障害物登録マップ",
  description: "地図上に障害物を登録するためのアプリケーション",
}

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex-1 container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">OSMR 障害物登録マップ</h1>
        <ObstacleMapContainer />
      </div>
    </main>
  )
}
