import ShelterMapContainer from "@/components/shelter-map-container";

export default function ShelterPage() {
  return (
    <main className="flex flex-col min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">避難所一覧</h1>
      <ShelterMapContainer />
    </main>
  );
} 