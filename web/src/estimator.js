// Port of analysis/cost_model.py. Keep the two in step: test/estimator.test.js pins these
// functions to the numbers the Python script prints.
export const KM_PER_MI = 1.609;
export const DSNY_UNIT_CAPEX = 6_700_000 / 45; // DSNY testimony, May 2022: $6.7M for 45 mini sweepers

export function today(opLoaded, miPerShift, { shifts = 250, capex = DSNY_UNIT_CAPEX, life = 7, upkeep = 15_000 } = {}) {
  const annual = capex / life + opLoaded + upkeep;
  const laneMi = miPerShift * shifts;
  return { annual, laneMi, perMi: annual / laneMi };
}

export function robot(capex, life, supLoaded, robotsPerSup, kmPerNight, { nights = 330, cloud = 1_500, upkeep = 8_000, insurance = 3_000 } = {}) {
  const annual = capex / life + supLoaded / robotsPerSup + cloud + upkeep + insurance;
  const laneMi = (kmPerNight / KM_PER_MI) * nights;
  return { annual, laneMi, perMi: annual / laneMi, miPerNight: kmPerNight / KM_PER_MI, nights };
}

export const SCENARIOS = {
  low: { label: 'Low', today: today(110_000, 20), robot: robot(40_000, 5, 110_000, 15, 12) },
  base: { label: 'Base', today: today(130_000, 15), robot: robot(60_000, 5, 130_000, 10, 10) },
  high: { label: 'High', today: today(160_000, 10), robot: robot(100_000, 5, 160_000, 5, 7) },
};

/**
 * Fleet needed to sweep a city's protected network a given number of times a week.
 * Staffed sweepers are counted the same way, so both columns buy the same coverage.
 */
export function estimateCity(laneMiles, { scenario = 'base', passesPerWeek = 1 } = {}) {
  const s = SCENARIOS[scenario];
  if (!s) throw new Error(`unknown scenario ${scenario}`);
  const milesPerYear = laneMiles * passesPerWeek * 52;
  const robots = Math.max(1, Math.ceil(milesPerYear / s.robot.laneMi));
  const sweepers = Math.max(1, Math.ceil(milesPerYear / s.today.laneMi));
  const robotCost = robots * s.robot.annual;
  const staffedCost = sweepers * s.today.annual;
  return {
    scenario,
    laneMiles,
    passesPerWeek,
    milesPerYear,
    robots,
    sweepers,
    milesPerNight: robots * s.robot.miPerNight,
    robotCost,
    staffedCost,
    saving: staffedCost - robotCost,
    ratio: staffedCost / robotCost,
    perMiRobot: s.robot.perMi,
    perMiStaffed: s.today.perMi,
  };
}
