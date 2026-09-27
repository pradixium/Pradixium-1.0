/*
 * PRADIXIUM™ — RESIDENTIAL LAND VALUATION ENGINE
 *
 * Core rule:
 *   Residential Fair Value = Building Component + Land Component
 *
 * Apartments remain primarily building-area driven.
 * Villas / houses use both built area and plot area.
 * Building plots use land value only.
 *
 * This module deliberately does NOT invent a land €/m² figure when no
 * reliable local land benchmark is available. A benchmark must come from
 * comparable land transactions, official land data, planning evidence or
 * another verified market source before it is treated as a valuation input.
 */

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseType(value) {
  const v = String(value || "").trim().toLowerCase();

  if (v.includes("plot") || v.includes("land") || v.includes("terrain") || v.includes("parcela")) {
    return "Land";
  }

  if (v.includes("villa")) return "Villa";
  if (v.includes("house") || v.includes("chalet") || v.includes("detached")) return "House";
  if (v.includes("townhouse") || v.includes("terraced")) return "Townhouse";
  if (v.includes("apartment") || v.includes("flat") || v.includes("piso") || v.includes("appartement")) {
    return "Apartment";
  }

  return "Apartment";
}

function isLandBasedResidential(type) {
  return ["Villa", "House", "Townhouse", "Land"].includes(type);
}

/*
 * Land area is NEVER treated as additional building area.
 *
 * For a pure building plot, land is 100% of the physical valuation base.
 * For a house/villa, land participates separately from the building.
 * Apartments intentionally return zero plot contribution unless an explicit
 * copropriété / parcel-share benchmark is supplied by a future data source.
 */
function calculateResidentialLandValue({
  propertyType,
  plotAreaM2,
  landBenchmarkEurPerM2,
  landBenchmarkConfidence = "Low",
  landUse = "residential",
  buildableAreaM2 = null,
  developmentPotential = false
}) {
  const type = normaliseType(propertyType);
  const plot = finiteNumber(plotAreaM2);
  const benchmark = finiteNumber(landBenchmarkEurPerM2);
  const buildable = finiteNumber(buildableAreaM2);

  const result = {
    applicable: isLandBasedResidential(type),
    propertyType: type,
    plotAreaM2: plot,
    landBenchmarkEurPerM2: benchmark,
    landBenchmarkConfidence,
    landUse,
    buildableAreaM2: buildable,
    developmentPotential: Boolean(developmentPotential),
    landValue: null,
    status: "insufficient_land_evidence",
    methodology: "Land area is valued separately from built area."
  };

  if (!result.applicable || !plot || plot <= 0) {
    result.status = type === "Apartment"
      ? "not_applicable_to_apartment"
      : "plot_area_required";
    result.landValue = 0;
    return result;
  }

  if (!benchmark || benchmark <= 0) {
    result.status = "land_benchmark_required";
    return result;
  }

  /*
   * The full plot is not automatically assumed to have equal development
   * value. Planning restrictions, frontage, protected land, setbacks and
   * buildability can materially change the value. Therefore the raw land
   * component is exposed explicitly and can later be adjusted by verified
   * planning evidence.
   */
  result.landValue = plot * benchmark;
  result.status = "calculated";

  return result;
}

function calculateResidentialFairValue({
  propertyType,
  builtAreaM2,
  buildingBenchmarkEurPerM2,
  buildingConditionAdjustment = 0,
  plotAreaM2 = null,
  landBenchmarkEurPerM2 = null,
  landBenchmarkConfidence = "Low",
  landUse = "residential",
  buildableAreaM2 = null,
  developmentPotential = false,
  rentalValue = null,
  rentalWeight = 0
}) {
  const type = normaliseType(propertyType);
  const built = finiteNumber(builtAreaM2);
  const buildingBenchmark = finiteNumber(buildingBenchmarkEurPerM2);
  const rentValue = finiteNumber(rentalValue);

  const land = calculateResidentialLandValue({
    propertyType: type,
    plotAreaM2,
    landBenchmarkEurPerM2,
    landBenchmarkConfidence,
    landUse,
    buildableAreaM2,
    developmentPotential
  });

  let buildingValue = 0;

  if (type !== "Land" && built && built > 0 && buildingBenchmark && buildingBenchmark > 0) {
    buildingValue = built * buildingBenchmark * (1 + Number(buildingConditionAdjustment || 0));
  }

  /* Pure land: no building value is manufactured. */
  if (type === "Land") {
    buildingValue = 0;
  }

  const physicalValue = buildingValue + (land.landValue || 0);

  let fairValue = physicalValue;
  if (rentValue && rentValue > 0 && rentalWeight > 0 && physicalValue > 0) {
    const weight = Math.max(0, Math.min(1, Number(rentalWeight)));
    fairValue = physicalValue * (1 - weight) + rentValue * weight;
  }

  return {
    propertyType: type,
    builtAreaM2: built,
    plotAreaM2: land.plotAreaM2,
    buildingBenchmarkEurPerM2: buildingBenchmark,
    buildingConditionAdjustment: Number(buildingConditionAdjustment || 0),
    buildingValue,
    landBenchmarkEurPerM2: land.landBenchmarkEurPerM2,
    landBenchmarkConfidence: land.landBenchmarkConfidence,
    landValue: land.landValue,
    landStatus: land.status,
    buildableAreaM2: land.buildableAreaM2,
    developmentPotential: land.developmentPotential,
    physicalValue,
    rentalValue: rentValue,
    rentalWeight: Number(rentalWeight || 0),
    fairValue,
    methodology: type === "Apartment"
      ? "Apartment: built area is primary; no villa-style plot value is added."
      : type === "Land"
        ? "Building plot: land is the primary valuation component; no building value is assumed."
        : "House/villa: building component plus separate land component."
  };
}

export {
  normaliseType,
  calculateResidentialLandValue,
  calculateResidentialFairValue
};
