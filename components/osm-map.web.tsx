import React from "react";
import type { OsmMapProps } from "./osm-map.shared";

function makeEmbedUrl(latitude: number, longitude: number): string {
  const latPadding = 0.012;
  const lngPadding = 0.016;
  const bbox = [
    longitude - lngPadding,
    latitude - latPadding,
    longitude + lngPadding,
    latitude + latPadding,
  ].map((value) => value.toFixed(6)).join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}

export function OsmMap({ latitude, longitude, height = 250 }: OsmMapProps) {
  return React.createElement("iframe", {
    title: "خريطة موقع الموصل الفعلي",
    src: makeEmbedUrl(latitude, longitude),
    loading: "lazy",
    referrerPolicy: "strict-origin-when-cross-origin",
    allowFullScreen: true,
    style: {
      width: "100%",
      height,
      border: 0,
      borderRadius: 14,
      marginTop: 10,
      backgroundColor: "#f2efe8",
    },
  });
}
