import type { QuoteMeasurement } from "@/lib/types";

type AreaSelection = NonNullable<QuoteMeasurement["areaSelection"]>;
type Sidewalk = NonNullable<QuoteMeasurement["sidewalk"]>;

export const BACK_ONLY_SIDEWALK_REASON = "back_only_sin_banqueta";

export function getSidewalkReport(
  areaSelection: AreaSelection,
  hasRoadPoint: boolean,
  setbackMeters: number,
): { sidewalk: Sidewalk; warning: string } {
  if (areaSelection === "back_only") {
    return {
      sidewalk: { valor: 0, tipo: "no_excluido", fuente: "sin_referencia_vial", motivo: BACK_ONLY_SIDEWALK_REASON },
      warning: "sidewalk_not_excluded",
    };
  }

  if (!hasRoadPoint) {
    return {
      sidewalk: { valor: 0, tipo: "no_excluido", fuente: "sin_referencia_vial" },
      warning: "sidewalk_not_excluded",
    };
  }

  return {
    sidewalk: { valor: setbackMeters, tipo: "estimado", fuente: "franja_fija_2.4m" },
    warning: "sidewalk_estimate",
  };
}
