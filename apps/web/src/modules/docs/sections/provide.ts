import {
  heading,
  note,
  paragraph,
  table,
  type DocsSection,
} from "../types";

export const PROVIDE_SECTION: DocsSection = {
  id: "provide",
  title: "What we provide",
  group: "product",
  summary:
    "Labs buy a world the agent can fail inside — not a pile of prompts. Four product surfaces share one pack format and one worker.",
  blocks: [
    paragraph(
      "Labs buy a world the agent can fail inside — not a pile of prompts. AgentForge ships four product surfaces that share one pack format and one worker.",
    ),
    table(
      ["Surface", "What you run", "What you get back"],
      [
        [
          "RL environments",
          "Experience packs with a reset (new workspace or new world)",
          "A pinned environment version, staged metrics, and trajectories",
        ],
        [
          "RLVR",
          "The same pack with rewardRecipe staged",
          "A verifiable reward: Σ (weight × hidden stage score) in [0, 1], written by the worker",
        ],
        [
          "Long-horizon multi-agent benchmark",
          "Catalog tasks with composition multi_agent (planner, coder, tester, reviewer)",
          "A scored trial over a long tool loop, not a single chat turn",
        ],
        [
          "Private evals",
          "Org-scoped repeats of the same agent on the same immutable version",
          "Logs and full rollouts for every failed attempt, plus recovery and preference export",
        ],
      ],
      "What AgentForge provides",
    ),
    heading("provide-hardness", "Hardness policy"),
    paragraph(
      "Packs on the hard split are authored so a latest frontier model should land around a 30% solve rate. That number is a design target for how we construct tasks — not a metric Next.js computes, not a public leaderboard, and not a named-model score from yesterday.",
    ),
    paragraph(
      "The policy that produces that target is concrete: hidden verifiers the agent cannot read, no grader on the agent filesystem, staged weights that sum to 1, recovery variants for the same family, long-horizon tool use, and cloned application UIs instead of a chat transcript. If a fluent write-up can score 1.0, the pack is too easy. If the oracle harness cannot score 1.0, the pack is broken.",
    ),
    table(
      ["Authoring check", "Pass condition"],
      [
        ["Oracle harness", "Reward 1.0 on the published pack"],
        ["NOP harness", "Reward strictly less than 1.0; partial credit only for stages that are true at reset (for example inventory held)"],
        ["Hard split", "Frontier solve rate targeted near 30% by construction, not displayed as a live score"],
        ["Recovery variants", "Sibling keys queued from real failure modes, not invented percentages"],
      ],
      "How hardness is checked",
    ),
    note(
      "Do not treat 30% as a published result. When you export rollouts, you will see your agents’ rewards. This site will not print a fake “31% yesterday” for anyone’s model.",
      "No live leaderboard",
    ),
    heading("provide-not", "What this slice does not include"),
    paragraph(
      "Billing, Kafka, Kubernetes-as-a-service, and ClickHouse are out of scope. RL training as a hosted product stays later; this tree ships the pack format, staged grader, simulated worlds, environment API, and PRIVATE rollout export. Live SaaS OAuth is not how simulated tools work.",
    ),
  ],
};
