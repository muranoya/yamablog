import L from "leaflet";

export const MAP_MEMO_KINDS: Array<{ id: number; name: string }> = [
  { id: 0, name: "山頂" },
  { id: 1, name: "峠" },
  { id: 2, name: "注意箇所" },
  { id: 3, name: "分岐" },
  { id: 4, name: "急登" },
  { id: 6, name: "水場" },
  { id: 7, name: "渡渉" },
  { id: 8, name: "標識" },
  { id: 9, name: "眺望" },
  { id: 101, name: "山小屋（有人）" },
  { id: 102, name: "山小屋（無人）" },
  { id: 103, name: "食事処" },
  { id: 104, name: "トイレ" },
  { id: 105, name: "登山口" },
  { id: 106, name: "駐車場" },
  { id: 107, name: "バス停" },
  { id: 108, name: "鉄道駅" },
  { id: 109, name: "温泉" },
  { id: 110, name: "キャンプ場" },
];

export function kindName(kind: number): string {
  return MAP_MEMO_KINDS.find((k) => k.id === kind)?.name ?? `種類 ${kind}`;
}

function markerColor(kind: number): string {
  if (kind >= 100) return "#6b21a8"; // 紫: 施設系
  if (kind === 2 || kind === 4) return "#dc2626"; // 赤: 危険・急登
  if (kind === 6 || kind === 7) return "#2563eb"; // 青: 水
  return "#16a34a"; // 緑: 地形一般
}

export function createMarkerIcon(kind: number): L.DivIcon {
  const color = markerColor(kind);
  const html = `
    <div style="
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      background: ${color};
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>
  `;
  return L.divIcon({
    html,
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}
