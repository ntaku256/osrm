"use client"
import React from "react";
import type { MapMode } from "@/app/content";

interface HeaderProps {
    mode: MapMode;
    onModeChange: (mode: MapMode) => void;
}

const Header: React.FC<HeaderProps> = ({ mode, onModeChange }) => {
    return (
        <header className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">OSM 障害物登録マップ</h1>
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name="mode"
                        value="view"
                        checked={mode === "view"}
                        onChange={() => onModeChange("view")}
                    />
                    <span className="text-sm">閲覧</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name="mode"
                        value="create"
                        checked={mode === "create"}
                        onChange={() => onModeChange("create")}
                    />
                    <span className="text-sm">登録</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                    <input
                        type="radio"
                        name="mode"
                        value="edit"
                        checked={mode === "edit"}
                        onChange={() => onModeChange("edit")}
                    />
                    <span className="text-sm">編集</span>
                </label>
            </div>
        </header>
    );
};

export default Header; 