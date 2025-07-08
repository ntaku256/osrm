"use client";
import Link from "next/link";
import { useAuthUser } from "@/hooks/useAuthUser";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState, useRef, useEffect } from "react";
import { Menu } from "lucide-react";
import { useBackendUser } from "@/hooks/useBackendUser";

export default function AppHeader() {
  const firebaseUser = useAuthUser();
  const { user, loading } = useBackendUser();
  const [open, setOpen] = useState(false);

  return (
    <header className="flex justify-between items-center p-4 border-b">
      {/* スマホ用: ハンバーガーメニュー */}
      <div className="sm:hidden flex w-full justify-between items-center">
        <Link href="/" className="text-lg font-bold">OSMマップ</Link>
        <button onClick={() => setOpen(true)} className="p-2"><Menu className="w-7 h-7" /></button>
        {open && (
          <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex">
            <div className="bg-white w-4/5 max-w-xs h-full shadow-lg p-6 flex flex-col gap-4 relative">
              <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-2xl text-red-500 hover:text-white hover:bg-red-600 rounded-full w-9 h-9 flex items-center justify-center transition">×</button>
              <nav className="flex flex-col gap-3 mt-8">
                <Link href="/" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>ホーム</Link>
                <Link href="/obstacle" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>障害物</Link>
                <Link href="/shelter" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>避難所</Link>
                <Link href="/route" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>ルート検索</Link>
                <Link href="/walk" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>ルート記録</Link>
                <Link href="/evacuation-simulation" className="text-lg font-semibold text-black rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>避難シミュレーション</Link>
              </nav>
              <div className="border-t my-3" />
              {loading ? (
                <span className="text-gray-400">ユーザー情報取得中...</span>
              ) : user ? (
                <div className="flex flex-col gap-2 bg-blue-50 rounded p-3">
                  <span className="font-bold text-blue-700">{user.username || firebaseUser?.displayName || firebaseUser?.email || "未設定"}</span>
                  <span className="text-sm text-gray-500">{user.role}</span>
                  <Link href="/profile" className="text-blue-700 font-semibold rounded hover:bg-blue-100 px-2 py-1 transition" onClick={() => setOpen(false)}>プロフィール編集</Link>
                  <button
                    onClick={() => { signOut(auth); setOpen(false); }}
                    className="text-red-600 font-semibold text-left rounded hover:bg-red-100 px-2 py-1 transition"
                  >ログアウト</button>
                </div>
              ) : (
                <Link href="/auth" className="text-blue-700 font-semibold" onClick={() => setOpen(false)}>ログイン</Link>
              )}
            </div>
          </div>
        )}
      </div>
      {/* PC用: 横並び */}
      <nav className="hidden sm:flex items-center gap-6">
        <Link href="/">ホーム</Link>
        <Link href="/obstacle">障害物</Link>
        <Link href="/shelter">避難所</Link>
        <Link href="/route">ルート検索</Link>
        <Link href="/walk">ルート記録</Link>
        <Link href="/evacuation-simulation">避難シミュレーション</Link>
      </nav>
      <div className="hidden sm:block relative">
        {user ? (
          <>
            <button
              className="ml-4 flex items-center gap-1 hover:underline"
              onClick={() => setOpen((v) => !v)}
            >
              {user.username || firebaseUser?.displayName || firebaseUser?.email || "未設定"}
              <span className="text-lg">▼</span>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-40 bg-white text-black border rounded shadow z-[9999]">
                <span className="text-sm text-gray-500 block px-4 mt-2 text-center">{user.role}</span>
                <Link href="/profile" className="block px-4 mb-2 hover:bg-gray-100">設定</Link>
                <button
                  onClick={() => signOut(auth)}
                  className="block w-full text-left px-4 mb-2 hover:bg-gray-100"
                >
                  ログアウト
                </button>
              </div>
            )}
          </>
        ) : (
          <Link href="/auth">ログイン</Link>
        )}
      </div>
    </header>
  );
} 