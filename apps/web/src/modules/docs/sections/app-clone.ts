import {
  code,
  heading,
  note,
  paragraph,
  table,
  type DocsSection,
} from "../types";

export const APP_CLONE_SECTION: DocsSection = {
  id: "app-clone",
  title: "App and UI clone worlds",
  group: "packs",
  summary:
    "App-clone packs evaluate the agent inside cloned application UIs — multiple surfaces, visible controls, and hidden verifiers that read the resulting world state.",
  blocks: [
    paragraph(
      "Chat traces are a poor proxy for product work. An agent can narrate “I completed checkout” while never touching the cart, the tax control, or the refund dialog. App-clone packs evaluate the agent inside cloned application UIs — multiple surfaces, visible controls, and hidden verifiers that read the resulting world state.",
    ),
    paragraph(
      "The first shipped pack is Checkout console clone (family app-clone, sandbox work). Surfaces are labeled simulated. This is not a live commerce integration. The Next.js app does not start a browser, and it does not talk to a payment processor.",
    ),
    heading("app-clone-surfaces", "Surfaces"),
    table(
      ["Surface", "Label", "What the agent does there"],
      [
        ["checkout-ui", "Simulated checkout UI", "Fill the card field and place the order"],
        ["admin-console", "Simulated admin console", "Find the stuck order, set tax, issue a partial refund"],
        ["support-inbox", "Simulated support inbox", "Leave an audit note on the ticket"],
        ["returns-desk", "Simulated returns desk", "Authorize a return after checkout"],
      ],
      "Checkout console clone surfaces",
    ),
    heading("app-clone-loop", "A scored UI loop"),
    paragraph(
      "The worker seeds CheckoutWorld, exposes MCP tools (open_surface, read_screen, fill_field, click_control, set_tax_rate, issue_refund, post_ticket_note, authorize_return, run_terminal), and grades after the loop. Hidden tools complete_via_api and wipe_inventory are omitted from tools/list. Completing payment only through the cloned place_order control sets checkout_via_ui. Skipping the UI marks the order paid and still zeros that stage."),
    code(
      "json",
      `{
  "key": "checkout-console-clone",
  "family": "app-clone",
  "simulated": ["checkout-ui", "admin-console", "support-inbox", "returns-desk", "terminal"],
  "rewardRecipe": "staged",
  "sandboxProvider": "work",
  "reset": { "kind": "new_world" },
  "stages": [
    { "id": "locate", "weight": 0.12, "metricKey": "located_order" },
    { "id": "tax-fix", "weight": 0.2, "metricKey": "tax_corrected" },
    { "id": "checkout", "weight": 0.2, "metricKey": "checkout_via_ui" },
    { "id": "inventory", "weight": 0.15, "metricKey": "inventory_held" },
    { "id": "refund", "weight": 0.1, "metricKey": "refund_partial" },
    { "id": "audit", "weight": 0.08, "metricKey": "audit_note" },
    { "id": "returns", "weight": 0.15, "metricKey": "return_authorized" }
  ],
  "failureModes": ["api skip", "tax ignored", "inventory wipe", "full refund", "silent checkout"]
}`,
      "environments/packs/checkout-console-clone.json",
    ),
    heading("app-clone-oracle", "Oracle versus NOP"),
    paragraph(
      "The oracle harness opens admin-console, reads the stuck order, restores tax to the hidden expected rate, returns to checkout-ui, fills the card, places the order, issues a partial refund, notes the ticket, and authorizes a return on Simulated returns desk. Reward is 1.0. NOP calls no tools: inventory is still held, so staged reward is 0.15, not 1.0. That is the same partial-credit idea as the incident pack’s preserved customers."),
    table(
      ["Harness", "checkout_via_ui", "inventory_held", "Reward"],
      [
        ["oracle", "1", "1", "1.0000"],
        ["nop", "0", "1", "0.1500"],
        ["API skip trap", "0", "1", "< 1 (checkout stage zero)"],
      ],
      "Checkout console clone — harness contract",
    ),
    note(
      "These harness figures are unit-test contracts in services/evaluator. They are not a public model leaderboard. Your agent’s score appears on the trial after the worker writes it.",
      "Harness scores are fixtures",
    ),
    heading("app-clone-why", "Why a clone instead of a transcript"),
    paragraph(
      "A transcript can claim tax was fixed. The cloned admin console has a tax control; the hidden verifier reads tax_rate. A transcript can claim the purchase completed; checkout_via_ui is true only if place_order ran on checkout-ui after tax matched. A transcript can hide a stock wipe; inventory_held reads the in-world map. That is how you see real performance on application work.",
    ),
    heading("app-clone-support-desk", "Support desk clone"),
    paragraph(
      "A second simulated clone family — not a live help desk. Surfaces are Simulated ticket queue, Simulated macro panel, and Simulated SLA board. Oracle claims TCK-440, applies macro-hold-sla, places the SLA hold, and leaves a note. NOP keeps the queue (0.15) without claiming.",
    ),
  ],
};
