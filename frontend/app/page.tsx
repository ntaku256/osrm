"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBackendUser } from "@/hooks/useBackendUser";
import { useAuthUser } from "@/hooks/useAuthUser";

export default function HomePage() {
  const { user, loading } = useBackendUser();
  const authUser = useAuthUser();
  const router = useRouter();
  const redirected = useRef(false);

  useEffect(() => {
    console.log("user", user, "loading", loading, "authUser", authUser);
    if (!loading && authUser && user === null && !redirected.current) {
      redirected.current = true;
      router.replace("/register");
    }
    // ログアウト時はリダイレクトフラグをリセット
    if (!authUser) {
      redirected.current = false;
    }
  }, [user, loading, authUser, router]);

  if (loading) return <div>Loading...</div>;
  if (authUser && !user) return null;

  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">ようこそ！</h1>
      <p className="mb-8">このアプリは障害物情報の共有サービスです。</p>
      <section className="mb-8 w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-bold text-lg mb-1 text-blue-700 flex items-center gap-2">
            <span>🗺️</span> 障害物マップ
          </h3>
          <p className="text-gray-700 text-sm">
            地図上で障害物（バリア・段差・狭い道など）を投稿・閲覧できます。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-bold text-lg mb-1 text-indigo-700 flex items-center gap-2">
            <span>🚶</span> 移動記録
          </h3>
          <p className="text-gray-700 text-sm">
            ルート記録、ルート履歴<br />
            GPSで歩いたルートを記録し、道に沿った軌跡や通過した障害物を一覧・地図で確認できます。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-bold text-lg mb-1 text-orange-700 flex items-center gap-2">
            <span>🏃‍♂️</span> 避難シミュレーション
          </h3>
          <p className="text-gray-700 text-sm">
            現在地から最寄りの避難所まで、障害物や危険度を考慮したルート案内・ナビゲーションが利用できます。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-bold text-lg mb-1 text-green-700 flex items-center gap-2">
            <span>🔑</span> ユーザー認証
          </h3>
          <p className="text-gray-700 text-sm">
            Googleアカウント等でログインし、自分の記録や投稿を管理できます。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4 border">
          <h3 className="font-bold text-lg mb-1 text-teal-700 flex items-center gap-2">
            <span>🏢</span> 避難所一覧
          </h3>
          <p className="text-gray-700 text-sm">
            登録されている避難所の位置や情報を地図で確認できます（閲覧専用）。
          </p>
        </div>
      </section>
      <nav className="flex gap-4">
        <a href="/obstacle" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">障害物マップへ</a>
        <a href="/walk" className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">ルート記録</a>
        <a href="/record" className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">ルート履歴</a>
        <a href="/evacuation-simulation" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">避難シミュレーション</a>
        <a href="/auth" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">認証ページへ</a>
        <a href="/shelter" className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">避難所一覧</a>
      </nav>
    </main>
  );
}
