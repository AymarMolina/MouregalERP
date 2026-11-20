import { describe, expect, it } from "vitest";
import { coordenadasDeMaps, esHostMaps, esLinkCortoMaps } from "./ubicacion";

describe("coordenadasDeMaps", () => {
  it("lee el pin del lugar antes que el centro de la vista", () => {
    const url =
      "https://www.google.com/maps/place/Parque+Kennedy/@-12.1200,-77.0300,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-12.1219!4d-77.0297";
    expect(coordenadasDeMaps(url)).toEqual({ lat: -12.1219, lng: -77.0297 });
  });

  it("lee la ubicación que comparte WhatsApp (?q=lat,lng)", () => {
    expect(coordenadasDeMaps("https://maps.google.com/?q=-12.0743,-77.0467")).toEqual({ lat: -12.0743, lng: -77.0467 });
    expect(coordenadasDeMaps("https://www.google.com/maps/search/?api=1&query=-12.07%2C-77.04")).toEqual({ lat: -12.07, lng: -77.04 });
  });

  it("lee /search/lat,+lng y @lat,lng", () => {
    expect(coordenadasDeMaps("https://www.google.com/maps/search/-12.0743,+-77.0467?entry=tts")).toEqual({ lat: -12.0743, lng: -77.0467 });
    expect(coordenadasDeMaps("https://www.google.com.pe/maps/@-12.05,-77.03,15z")).toEqual({ lat: -12.05, lng: -77.03 });
  });

  it("rechaza hosts ajenos, links sin coordenadas y valores fuera de rango", () => {
    expect(coordenadasDeMaps("https://evil.com/maps?q=-12,-77")).toBeNull();
    expect(coordenadasDeMaps("https://www.google.com/maps/place/Lima")).toBeNull();
    expect(coordenadasDeMaps("https://maps.google.com/?q=99,-77")).toBeNull();
    expect(coordenadasDeMaps("no es un link")).toBeNull();
  });
});

describe("hosts", () => {
  it("acepta Google Maps y los links cortos, no imitaciones", () => {
    expect(esHostMaps("maps.app.goo.gl")).toBe(true);
    expect(esHostMaps("www.google.com.pe")).toBe(true);
    expect(esHostMaps("google.com.evil.io")).toBe(false);
    expect(esLinkCortoMaps(new URL("https://maps.app.goo.gl/AbC123"))).toBe(true);
    expect(esLinkCortoMaps(new URL("https://goo.gl/otra"))).toBe(false);
  });
});
