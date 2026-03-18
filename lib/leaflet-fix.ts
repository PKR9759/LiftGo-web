// lib/leaflet-fix.ts
import L from 'leaflet'

export const fixLeafletIcons = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl

  L.Icon.Default.mergeOptions({
    iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

// custom colored markers
export const makeIcon = (color: 'blue' | 'green' | 'red' | 'orange') => {
  const colors: Record<string, string> = {
    blue:   '#3b82f6',
    green:  '#22c55e',
    red:    '#ef4444',
    orange: '#f97316',
  }

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 24px; height: 24px;
        background: ${colors[color]};
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize:   [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  })
}