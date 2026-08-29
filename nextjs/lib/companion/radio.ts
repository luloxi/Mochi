export type RadioStationId = "lluvia" | "foco" | "olas" | "silencio";

export type RadioStation = {
  id: RadioStationId;
  label: string;
  hint: string;
  kind: "rain" | "brown" | "wave" | "off";
};

export const RADIO_STATIONS: RadioStation[] = [
  { id: "lluvia", label: "Lluvia", hint: "para soñar un rato", kind: "rain" },
  { id: "foco", label: "Foco", hint: "ruido marrón, para laburar", kind: "brown" },
  { id: "olas", label: "Olas", hint: "suave, no apura", kind: "wave" },
  { id: "silencio", label: "Silencio", hint: "apaga todo", kind: "off" },
];

export function radioStationById(id: string | null | undefined): RadioStation {
  return RADIO_STATIONS.find((row) => row.id === id) || RADIO_STATIONS[3];
}
