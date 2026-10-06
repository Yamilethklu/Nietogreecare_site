import test from "node:test";
import assert from "node:assert/strict";

import { BACK_ONLY_SIDEWALK_REASON, getSidewalkReport } from "../src/lib/sidewalk-report.ts";

test("back-only selection reports no sidewalk exclusion", () => {
  assert.deepEqual(getSidewalkReport("back_only", true, 2.4), {
    sidewalk: {
      valor: 0,
      tipo: "no_excluido",
      fuente: "sin_referencia_vial",
      motivo: BACK_ONLY_SIDEWALK_REASON,
    },
    warning: "sidewalk_not_excluded",
  });
});

test("front-only and front-and-back selections retain estimated sidewalk exclusion", () => {
  for (const areaSelection of ["front_only", "front_back"] as const) {
    assert.deepEqual(getSidewalkReport(areaSelection, true, 2.4), {
      sidewalk: { valor: 2.4, tipo: "estimado", fuente: "franja_fija_2.4m" },
      warning: "sidewalk_estimate",
    });
  }
});

test("front selection without a road point retains the non-exclusion warning", () => {
  assert.deepEqual(getSidewalkReport("front_only", false, 2.4), {
    sidewalk: { valor: 0, tipo: "no_excluido", fuente: "sin_referencia_vial" },
    warning: "sidewalk_not_excluded",
  });
});
