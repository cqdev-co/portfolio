import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Penny Stock Scanner";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontSize: 60,
              fontWeight: "bold",
              color: "#ffffff",
              marginBottom: 20,
            }}
          >
            Penny Stock Scanner
          </h1>
          <p
            style={{
              fontSize: 30,
              color: "#a1a1aa",
              textAlign: "center",
            }}
          >
            Find explosive setups before they move
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

