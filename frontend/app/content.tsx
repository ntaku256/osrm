"use client"
import ObstacleMapContainer from "@/components/obstacle-map-container"
import Header from "@/components/Header"
import { useState } from "react"

// MapMode型を定義
export type MapMode = "view" | "create" | "edit"

export default function Content() {
    const [mode, setMode] = useState<MapMode>("view")
    return (
        <div className="flex-1 container mx-auto p-4">
            <Header mode={mode} onModeChange={setMode} />
            <ObstacleMapContainer mode={mode} />
        </div>
    )
}
