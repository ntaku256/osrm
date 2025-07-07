import type { Metadata } from "next"
import Content from "../content";

export default function ObstaclePage() {
  return (
    <main className="flex flex-col min-h-screen">
      <Content />
    </main>
  );
}

export const metadata: Metadata = {
  title: "Obstacle Page",
  description: "This is the obstacle page",
};
 