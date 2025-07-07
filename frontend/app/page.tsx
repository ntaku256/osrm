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
      <nav className="flex gap-4">
        <a href="/obstacle" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">障害物マップへ</a>
        <a href="/auth" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">認証ページへ</a>
      </nav>
    </main>
  );
}
