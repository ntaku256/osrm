"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const [form, setForm] = useState({
    username: "",
    age: "",
    gender: "",
    has_disability: false,
    evacuation_level: 3,
  });
  const [error, setError] = useState("");
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" && e.target instanceof HTMLInputElement ? e.target.checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    // バリデーション
    if (!form.username || !form.age || !form.gender || !form.evacuation_level) {
      setError("全ての項目を入力してください");
      return;
    }
    const res = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        age: Number(form.age),
        evacuation_level: Number(form.evacuation_level),
      }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setError("登録に失敗しました");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">ユーザー登録</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        <input name="username" placeholder="ユーザー名" value={form.username} onChange={handleChange} className="border p-2 rounded" />
        <input name="age" type="number" placeholder="年齢" value={form.age} onChange={handleChange} className="border p-2 rounded" />
        <select name="gender" value={form.gender} onChange={handleChange} className="border p-2 rounded">
          <option value="">性別を選択</option>
          <option value="male">男性</option>
          <option value="female">女性</option>
          <option value="other">その他</option>
        </select>
        <label className="flex items-center gap-2">
          <input name="has_disability" type="checkbox" checked={form.has_disability} onChange={handleChange} />
          障害あり
        </label>
        <select name="evacuation_level" value={form.evacuation_level} onChange={handleChange} className="border p-2 rounded">
          <option value={1}>1: 要介護レベル</option>
          <option value={2}>2: 歩行困難</option>
          <option value={3}>3: 標準</option>
          <option value={4}>4: 健康で機敏</option>
          <option value={5}>5: 専門的避難支援能力</option>
        </select>
        {error && <div className="text-red-500">{error}</div>}
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">登録</button>
      </form>
    </main>
  );
} 