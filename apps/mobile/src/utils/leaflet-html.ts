type LeafletHtmlOptions = {
  latitude: number;
  longitude: number;
  interactive?: boolean;
  title?: string;
  subtitle?: string;
};

type LeafletWorkshopMarker = {
  id: string;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
};

type MapCoordinates = {
  latitude: number;
  longitude: number;
};

type WorkshopsLeafletHtmlOptions = {
  workshops: LeafletWorkshopMarker[];
  center?: MapCoordinates | null;
  userLocation?: MapCoordinates | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function serializeForScript<T>(value: T) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function createLeafletHtml({
  latitude,
  longitude,
  interactive = false,
  title,
  subtitle,
}: LeafletHtmlOptions) {
  const markerTitle = escapeHtml(title ?? 'СТО');
  const markerSubtitle = escapeHtml(subtitle ?? '');

  return `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        background: #f4efe7;
      }

      body {
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .hint {
        position: absolute;
        left: 12px;
        right: 12px;
        bottom: 12px;
        z-index: 999;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255, 253, 249, 0.96);
        color: #182120;
        font-size: 13px;
        line-height: 1.35;
        box-shadow: 0 8px 20px rgba(24, 33, 32, 0.12);
      }

      .leaflet-control-attribution {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    ${
      interactive
        ? '<div class="hint">Тапните по карте или перетащите маркер, чтобы выбрать точную точку.</div>'
        : ''
    }
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const interactive = ${interactive ? 'true' : 'false'};
      const initial = {
        latitude: ${latitude},
        longitude: ${longitude}
      };

      function postMessage(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function escapePopup(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      const map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: true
      }).setView([initial.latitude, initial.longitude], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const marker = L.marker([initial.latitude, initial.longitude], {
        draggable: interactive
      }).addTo(map);

      const popupParts = ['<strong>${markerTitle}</strong>'];
      if (${markerSubtitle ? 'true' : 'false'}) {
        popupParts.push('<div>${markerSubtitle}</div>');
      }
      marker.bindPopup(popupParts.join('')).openPopup();

      function syncLocation(latitude, longitude) {
        marker.setLatLng([latitude, longitude]);
        postMessage({
          type: 'location-change',
          latitude,
          longitude
        });
      }

      if (interactive) {
        map.on('click', function (event) {
          syncLocation(event.latlng.lat, event.latlng.lng);
        });

        marker.on('dragend', function (event) {
          const next = event.target.getLatLng();
          syncLocation(next.lat, next.lng);
        });
      }

      postMessage({
        type: 'ready',
        latitude: initial.latitude,
        longitude: initial.longitude
      });
    </script>
  </body>
</html>`;
}

export function createWorkshopsLeafletHtml({
  workshops,
  center,
  userLocation,
}: WorkshopsLeafletHtmlOptions) {
  const serializedWorkshops = serializeForScript(workshops);
  const serializedCenter = serializeForScript(center ?? null);
  const serializedUserLocation = serializeForScript(userLocation ?? null);

  return `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        background: #f4efe7;
      }

      body {
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-control-attribution {
        display: none;
      }

      .map-pin {
        background: transparent;
        border: none;
      }

      .map-pin__dot {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #d8682a;
        border: 4px solid rgba(255, 253, 249, 0.96);
        box-shadow: 0 8px 18px rgba(24, 33, 32, 0.22);
      }

      .popup {
        min-width: 160px;
      }

      .popup strong {
        display: block;
        margin-bottom: 4px;
        color: #182120;
        font-size: 14px;
      }

      .popup span {
        display: block;
        color: #6f7e79;
        font-size: 12px;
        line-height: 1.4;
      }

      .popup em {
        display: inline-block;
        margin-top: 8px;
        color: #a74b16;
        font-style: normal;
        font-weight: 700;
        font-size: 12px;
      }

      .empty {
        position: absolute;
        left: 12px;
        right: 12px;
        top: 12px;
        z-index: 999;
        padding: 12px 14px;
        border-radius: 16px;
        background: rgba(255, 253, 249, 0.96);
        color: #182120;
        font-size: 13px;
        line-height: 1.35;
        box-shadow: 0 8px 20px rgba(24, 33, 32, 0.12);
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const workshops = ${serializedWorkshops};
      const requestedCenter = ${serializedCenter};
      const userLocation = ${serializedUserLocation};
      const fallback = {
        latitude: 41.311081,
        longitude: 69.240562
      };
      const initialCenter =
        requestedCenter ||
        userLocation ||
        (workshops[0]
          ? {
              latitude: workshops[0].latitude,
              longitude: workshops[0].longitude
            }
          : fallback);

      function postMessage(payload) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
      }

      function escapePopup(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      const map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        touchZoom: true
      }).setView([initialCenter.latitude, initialCenter.longitude], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      if (!workshops.length) {
        const notice = document.createElement('div');
        notice.className = 'empty';
        notice.textContent = 'По этим фильтрам пока нет опубликованных объявлений с точкой на карте.';
        document.body.appendChild(notice);
      }

      const bounds = [];
      const icon = L.divIcon({
        className: 'map-pin',
        html: '<div class="map-pin__dot"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        popupAnchor: [0, -12]
      });
      const userIcon = L.divIcon({
        className: 'map-pin',
        html: '<div style="width: 20px; height: 20px; border-radius: 999px; background: #2563eb; border: 4px solid rgba(255, 255, 255, 0.92); box-shadow: 0 8px 18px rgba(37, 99, 235, 0.28);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      let suppressNextMapClick = false;

      workshops.forEach((item) => {
        const marker = L.marker([item.latitude, item.longitude], { icon }).addTo(map);
        marker.bindPopup(
          '<div class="popup">' +
            '<strong>' + escapePopup(item.title) + '</strong>' +
            '<span>' + escapePopup(item.address) + '</span>' +
            '<em>Рейтинг ' + Number(item.rating || 0).toFixed(1) + '</em>' +
          '</div>'
        );

        marker.on('click', function (event) {
          suppressNextMapClick = true;
          window.setTimeout(function () {
            suppressNextMapClick = false;
          }, 0);

          if (event && event.originalEvent && typeof event.originalEvent.stopPropagation === 'function') {
            event.originalEvent.stopPropagation();
          }

          postMessage({
            type: 'select-workshop',
            workshopId: item.id
          });
        });

        bounds.push([item.latitude, item.longitude]);
      });

      if (userLocation) {
        L.marker([userLocation.latitude, userLocation.longitude], {
          icon: userIcon,
          interactive: false
        }).addTo(map);
      }

      map.on('click', function () {
        if (suppressNextMapClick) {
          return;
        }

        map.closePopup();
        postMessage({
          type: 'deselect-workshop'
        });
      });

      if (requestedCenter) {
        map.setView([requestedCenter.latitude, requestedCenter.longitude], 13);
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 14);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, {
          padding: [32, 32]
        });
      }

      postMessage({
        type: 'ready'
      });
    </script>
  </body>
</html>`;
}
