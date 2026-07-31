export const SAMPLE_JSON = JSON.stringify(
  {
    survey: {
      id: "core-77b",
      site: "Bench 4, North Ridge",
      collected_at: "2026-04-11T08:14:00Z",
      operator: { name: "R. Adeyemi", certified: true, age: 34 },
      instruments: ["sieve stack", "field spectrometer", "hand lens"],
    },
    samples: [
      {
        tag: "S-001",
        depth_cm: 12,
        age: 18,
        moisture: 0.14,
        fractions: { gravel: 0.08, sand: 0.61, silt: 0.24, clay: 0.07 },
        notes: null,
        flagged: false,
      },
      {
        tag: "S-002",
        depth_cm: 45,
        age: 27,
        moisture: 0.31,
        fractions: { gravel: 0.02, sand: 0.38, silt: 0.41, clay: 0.19 },
        notes: "organic streak at 40 cm",
        flagged: true,
      },
      {
        tag: "S-003",
        depth_cm: 96,
        age: 41,
        moisture: 0.22,
        fractions: { gravel: 0.19, sand: 0.55, silt: 0.2, clay: 0.06 },
        notes: null,
        flagged: false,
      },
    ],
    totals: { samples: 3, mass_g: 2410.75, complete: true },
  },
  null,
  2,
);
