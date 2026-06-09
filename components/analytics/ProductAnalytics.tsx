"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | null;
type AnalyticsProperties = Record<string, AnalyticsValue>;

export function trackProductEvent(eventName: string, properties?: AnalyticsProperties): void {
  track(eventName, properties);
}

export function TrackOnMount({
  eventName,
  properties
}: {
  eventName: string;
  properties?: AnalyticsProperties;
}) {
  useEffect(() => {
    trackProductEvent(eventName, properties);
  }, [eventName, properties]);

  return null;
}
