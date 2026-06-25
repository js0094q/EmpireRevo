export type BoardEmptyStateCopy = {
  title: string;
  message: string;
};

export function getBoardEmptyStateCopy(params: {
  leagueKey: string;
  providerEventCount?: number;
}): BoardEmptyStateCopy {
  if (params.leagueKey === "fifa_world_cup") {
    if ((params.providerEventCount ?? 0) > 0) {
      return {
        title: "FIFA World Cup is enabled, but no sportsbook odds are currently available from the provider.",
        message: "Try another market or check back closer to kickoff."
      };
    }

    return {
      title: "No FIFA World Cup markets are currently available.",
      message: "Try another league or check back when provider markets are posted."
    };
  }

  if (params.leagueKey === "college_baseball") {
    return {
      title: "No college baseball odds are currently available.",
      message: "The provider has no comparable College Baseball markets in the current feed."
    };
  }

  return {
    title: "No qualifying markets for current filters.",
    message: "Try another league, market, or book threshold."
  };
}
