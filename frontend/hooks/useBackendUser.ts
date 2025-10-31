import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuthUser } from "./useAuthUser";

export function useBackendUser() {
  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const authUser = useAuthUser();

  useEffect(() => {
    if (authUser === undefined) {
      // Firebaseの初期化待ち: APIリクエストを送らない
      return;
    }
    if (!authUser) {
      setUser(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiFetch("/users/me")
      .then(async (res) => {
        let data = undefined;
        try {
          data = await res.json();
        } catch (e) {
          data = undefined;
        }
        console.log("API status:", res.status, "data:", data);
        if (res.status === 404) {
          setUser(null);
        } else if (res.ok && data && data.firebase_uid) {
          console.log("data", data);
          setUser(data);
        } else {
          setUser(undefined); // 200だけどデータ不正 or 他のエラー
        }
      })
      .finally(() => setLoading(false));
  }, [authUser]);

  return { user, loading };
} 