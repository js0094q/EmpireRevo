export type EvPresentationTone = "positive" | "neutral";

export type EvPresentation = {
  label: string;
  tone: EvPresentationTone;
};

export function getEvPresentation(ev: number): EvPresentation {
  if (!Number.isFinite(ev)) {
    return {
      label: "No active opportunity",
      tone: "neutral"
    };
  }

  if (ev > 2) {
    return {
      label: "Strong opportunity",
      tone: "positive"
    };
  }

  if (ev > 0.5) {
    return {
      label: "Attractive edge",
      tone: "neutral"
    };
  }

  if (ev >= 0) {
    return {
      label: "Near market",
      tone: "neutral"
    };
  }

  if (ev > -0.5) {
    return {
      label: "Market aligned",
      tone: "neutral"
    };
  }

  if (ev > -2) {
    return {
      label: "Market is less favorable",
      tone: "neutral"
    };
  }

  return {
    label: "Below consensus",
    tone: "neutral"
  };
}
