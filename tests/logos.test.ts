import test from "node:test";
import assert from "node:assert/strict";
import { canonicalizeTeamName, resolveTeamLogo } from "../lib/server/odds/logos";
import type { LeagueKey } from "../lib/odds/schemas";

const TEAMS_BY_LEAGUE: Record<Exclude<LeagueKey, "ncaab">, string[]> = {
  nba: [
    "Atlanta Hawks",
    "Boston Celtics",
    "Brooklyn Nets",
    "Charlotte Hornets",
    "Chicago Bulls",
    "Cleveland Cavaliers",
    "Dallas Mavericks",
    "Denver Nuggets",
    "Detroit Pistons",
    "Golden State Warriors",
    "Houston Rockets",
    "Indiana Pacers",
    "Los Angeles Clippers",
    "Los Angeles Lakers",
    "Memphis Grizzlies",
    "Miami Heat",
    "Milwaukee Bucks",
    "Minnesota Timberwolves",
    "New Orleans Pelicans",
    "New York Knicks",
    "Oklahoma City Thunder",
    "Orlando Magic",
    "Philadelphia 76ers",
    "Phoenix Suns",
    "Portland Trail Blazers",
    "Sacramento Kings",
    "San Antonio Spurs",
    "Toronto Raptors",
    "Utah Jazz",
    "Washington Wizards"
  ],
  nfl: [
    "Arizona Cardinals",
    "Atlanta Falcons",
    "Baltimore Ravens",
    "Buffalo Bills",
    "Carolina Panthers",
    "Chicago Bears",
    "Cincinnati Bengals",
    "Cleveland Browns",
    "Dallas Cowboys",
    "Denver Broncos",
    "Detroit Lions",
    "Green Bay Packers",
    "Houston Texans",
    "Indianapolis Colts",
    "Jacksonville Jaguars",
    "Kansas City Chiefs",
    "Las Vegas Raiders",
    "Los Angeles Chargers",
    "Los Angeles Rams",
    "Miami Dolphins",
    "Minnesota Vikings",
    "New England Patriots",
    "New Orleans Saints",
    "New York Giants",
    "New York Jets",
    "Philadelphia Eagles",
    "Pittsburgh Steelers",
    "Seattle Seahawks",
    "San Francisco 49ers",
    "Tampa Bay Buccaneers",
    "Tennessee Titans",
    "Washington Commanders"
  ],
  nhl: [
    "Anaheim Ducks",
    "Boston Bruins",
    "Buffalo Sabres",
    "Carolina Hurricanes",
    "Columbus Blue Jackets",
    "Calgary Flames",
    "Chicago Blackhawks",
    "Colorado Avalanche",
    "Dallas Stars",
    "Detroit Red Wings",
    "Edmonton Oilers",
    "Florida Panthers",
    "Los Angeles Kings",
    "Minnesota Wild",
    "Montreal Canadiens",
    "Nashville Predators",
    "New Jersey Devils",
    "New York Islanders",
    "New York Rangers",
    "Ottawa Senators",
    "Philadelphia Flyers",
    "Pittsburgh Penguins",
    "San Jose Sharks",
    "Seattle Kraken",
    "St. Louis Blues",
    "Tampa Bay Lightning",
    "Toronto Maple Leafs",
    "Utah Hockey Club",
    "Vancouver Canucks",
    "Vegas Golden Knights",
    "Washington Capitals",
    "Winnipeg Jets"
  ],
  mlb: [
    "Arizona Diamondbacks",
    "Atlanta Braves",
    "Athletics",
    "Baltimore Orioles",
    "Boston Red Sox",
    "Chicago Cubs",
    "Chicago White Sox",
    "Cincinnati Reds",
    "Cleveland Guardians",
    "Colorado Rockies",
    "Detroit Tigers",
    "Houston Astros",
    "Kansas City Royals",
    "Los Angeles Angels",
    "Los Angeles Dodgers",
    "Miami Marlins",
    "Milwaukee Brewers",
    "Minnesota Twins",
    "New York Mets",
    "New York Yankees",
    "Philadelphia Phillies",
    "Pittsburgh Pirates",
    "San Diego Padres",
    "San Francisco Giants",
    "Seattle Mariners",
    "St. Louis Cardinals",
    "Tampa Bay Rays",
    "Texas Rangers",
    "Toronto Blue Jays",
    "Washington Nationals"
  ]
};

test("logo coverage resolves canonical teams for mapped pro leagues", () => {
  for (const [league, teams] of Object.entries(TEAMS_BY_LEAGUE) as Array<[Exclude<LeagueKey, "ncaab">, string[]]>) {
    for (const team of teams) {
      assert.ok(resolveTeamLogo(team, league), `${league}:${team} should resolve to a logo`);
    }
  }
});

test("canonicalizeTeamName handles common feed aliases and punctuation", () => {
  assert.equal(canonicalizeTeamName("L.A. Clippers", "nba"), "Los Angeles Clippers");
  assert.equal(canonicalizeTeamName("N.Y. Knicks", "nba"), "New York Knicks");
  assert.equal(canonicalizeTeamName("NYK", "nba"), "New York Knicks");
  assert.equal(canonicalizeTeamName("GSW Warriors", "nba"), "Golden State Warriors");
  assert.equal(canonicalizeTeamName("SF 49ers", "nfl"), "San Francisco 49ers");
  assert.equal(canonicalizeTeamName("Washington Football Team", "nfl"), "Washington Commanders");
  assert.equal(canonicalizeTeamName("Saint Louis Blues", "nhl"), "St. Louis Blues");
  assert.equal(canonicalizeTeamName("Utah Mammoth", "nhl"), "Utah Hockey Club");
  assert.equal(canonicalizeTeamName("D-Backs", "mlb"), "Arizona Diamondbacks");
  assert.equal(canonicalizeTeamName("Sacramento Athletics", "mlb"), "Athletics");
});

test("resolveTeamLogo matches aliases to the same canonical asset", () => {
  assert.equal(
    resolveTeamLogo("LA Clippers", "nba"),
    resolveTeamLogo("Los Angeles Clippers", "nba")
  );
  assert.equal(resolveTeamLogo("N.Y. Knicks", "nba"), resolveTeamLogo("New York Knicks", "nba"));
  assert.equal(resolveTeamLogo("A's", "mlb"), resolveTeamLogo("Athletics", "mlb"));
  assert.equal(resolveTeamLogo("TBL Lightning", "nhl"), resolveTeamLogo("Tampa Bay Lightning", "nhl"));
});

test("canonicalizeTeamName avoids ambiguous cross-league aliases without league context", () => {
  assert.equal(canonicalizeTeamName("Rangers"), "Rangers");
});
