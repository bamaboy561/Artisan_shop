import { ImageResponse } from "next/og";

export const alt = "Artisan";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#f1eee8",
        color: "#151411",
        padding: "64px",
        fontFamily: "Arial",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 28,
          letterSpacing: 8,
          textTransform: "uppercase",
          color: "#9d573d",
        }}
      >
        <span>Artisan</span>
        <span>Furniture materials</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            fontSize: 104,
            lineHeight: 0.9,
            letterSpacing: -5,
            fontWeight: 700,
            maxWidth: 860,
          }}
        >
          Materials, cutting and hardware.
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            fontSize: 24,
            color: "#5f5952",
          }}
        >
          <span>LDSP</span>
          <span>/</span>
          <span>MDF</span>
          <span>/</span>
          <span>AGT</span>
          <span>/</span>
          <span>Albero</span>
          <span>/</span>
          <span>Swiss Krono</span>
        </div>
      </div>
    </div>,
    size,
  );
}
