import type { Metadata } from "next"
import Content from "./content"

export const metadata: Metadata = {
  title: "OSM 障害物登録マップ",
  description: "地図上に障害物を登録するためのアプリケーション",
}

export default function HomePage() {
  return (
    <main className="flex flex-col min-h-screen">
      <Content />
    </main>
  )
}
