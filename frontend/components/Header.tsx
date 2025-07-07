"use client"
import React from "react";
import Link from "next/link";
import type { MapMode } from "@/app/content";
import { Eye, PlusCircle, Edit3, Navigation } from "lucide-react";

interface HeaderProps {
    mode: MapMode;
    onModeChange: (mode: MapMode) => void;
}

const modeMeta: Record<MapMode, { label: string; color: string; icon: React.ReactNode }> = {
    view: {
        label: "閲覧モード",
        color: "bg-green-600 hover:bg-green-700",
        icon: <Eye className="inline w-5 h-5 mr-2" />,
    },
    create: {
        label: "登録モード",
        color: "bg-blue-600 hover:bg-blue-700",
        icon: <PlusCircle className="inline w-5 h-5 mr-2" />,
    },
    edit: {
        label: "編集モード",
        color: "bg-yellow-500 hover:bg-yellow-600 text-black",
        icon: <Edit3 className="inline w-5 h-5 mr-2" />,
    },
};

const modeOrder: MapMode[] = ["view", "create", "edit"];

const Header: React.FC<HeaderProps> = ({ mode, onModeChange }) => {
    // 次のモードを取得
    const getNextMode = (current: MapMode): MapMode => {
        const idx = modeOrder.indexOf(current);
        return modeOrder[(idx + 1) % modeOrder.length];
    };

    const { label, color, icon } = modeMeta[mode];

    return (
        <header className="mb-4">
            {/* スマホ用: タイトルの下・右端にボタン */}
            <div className="flex flex-col gap-2 sm:hidden">
                <h1 className="text-2xl font-bold">OSM 障害物登録マップ</h1>
                <div className="flex w-full justify-end gap-2">
                    <button
                        className={`max-w-xs px-4 py-2 rounded-md font-semibold shadow transition flex items-center gap-2 ${color}`}
                        onClick={() => onModeChange(getNextMode(mode))}
                    >
                        {icon}
                        {label}
                    </button>
                </div>
            </div>
            {/* PC用: 横並び */}
            <div className="hidden sm:flex sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold">OSM 障害物登録マップ</h1>
                <div className="flex gap-2">
                    <button
                        className={`px-4 py-2 rounded-md font-semibold shadow transition flex items-center gap-2 ${color}`}
                        onClick={() => onModeChange(getNextMode(mode))}
                    >
                        {icon}
                        {label}
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header; 
