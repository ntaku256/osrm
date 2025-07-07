"use client"
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function AuthPage() {
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h2 className="text-2xl font-bold mb-4">ログイン</h2>
      <button
        onClick={handleSignIn}
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Googleでログイン
      </button>
    </div>
  );
} 