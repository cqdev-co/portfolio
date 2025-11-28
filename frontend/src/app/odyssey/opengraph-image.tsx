import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Odyssey Trading Dashboard";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: "bold",
            marginBottom: 20,
          }}
        >
          Odyssey
        </div>
        <div
          style={{
            fontSize: 32,
            opacity: 0.9,
          }}
        >
          Trading Dashboard
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

