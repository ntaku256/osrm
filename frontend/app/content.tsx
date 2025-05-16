"use client"
import ObstacleMapContainer from "@/components/obstacle-map-container"
import Header from "@/components/Header"
import { useState } from "react"

export default function Content() {
    const [editMode, setEditMode] = useState(true)
    return (
        <div className="flex-1 container mx-auto p-4">
            <Header editMode={editMode} onModeChange={setEditMode} />
            <ObstacleMapContainer editMode={editMode} />
        </div>
    )
}
