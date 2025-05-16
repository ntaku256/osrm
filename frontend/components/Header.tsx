"use client"
import React from "react";

interface HeaderProps {
    editMode: boolean;
    onModeChange: (edit: boolean) => void;
}

const Header: React.FC<HeaderProps> = ({ editMode, onModeChange }) => {
    return (
        <header className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">OSM 障害物登録マップ</h1>
            <div className="flex items-center gap-2">
                <span className="text-sm">閲覧モード</span>
                <label className="inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        checked={editMode}
                        onChange={e => onModeChange(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 transition-all"></div>
                    <span className="ml-2 text-sm">編集モード</span>
                </label>
            </div>
        </header>
    );
};

export default Header; 