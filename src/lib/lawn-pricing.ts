export function calculateLawnQuote(fields: {
  serviceFrequency: "ongoing" | "one_time";
  mowFrequency: "weekly" | "bi_weekly";
  areaSelection: "front_back" | "front_only" | "back_only";
  isCornerLot: boolean;
}) {
  let basePrice = 42;
  if (fields.mowFrequency === "weekly") {
    basePrice = fields.areaSelection === "front_back" ? 38 : 30;
  } else {
    basePrice = fields.areaSelection === "front_back" ? 42 : 34;
  }

  if (fields.isCornerLot) {
    basePrice += 5;
  }

  if (fields.serviceFrequency === "one_time") {
    basePrice += 20;
  }

  const frequencyText = fields.mowFrequency === "weekly" ? "weekly" : "bi-weekly";
  const rateText = fields.serviceFrequency === "one_time" ? `$${basePrice} one-time + tax` : `$${basePrice} ${frequencyText} + tax`;
  const perCutText = `$${basePrice}/cut`;

  return {
    price: basePrice,
    frequencyText,
    rateText,
    perCutText,
  };
}

