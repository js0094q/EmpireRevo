export type EvPresentationTone = "positive" | "neutral" | "caution";

export type EvPresentation = {
  label: string;
  tone: EvPresentationTone;
};

export function getEvPresentation(ev: number): EvPresentation {
  if (!Number.isFinite(ev)) {
    return {
      label: "No edge detected",
      tone: "neutral"
    };
  }

  if (ev > 2) {
    return {
      label: "Positive edge",
      tone: "positive"
    };
  }

  if (ev > 0.5) {
    return {
      label: "Small edge",
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
      label: "Below market price",
      tone: "caution"
    };
  }

  return {
    label: "Consensus stronger elsewhere",
    tone: "caution"
  };
}
