import type { AnalysisProvider, ReviewProvider } from "@agentforge/contracts";

/** Stub only — structural validation never calls this. */
export const unimplementedReviewProvider: ReviewProvider = {
  id: "unimplemented-review",
  review() {
    return Promise.reject(
      new Error("ReviewProvider is not implemented. No LLM reviewer is wired."),
    );
  },
};

/** Stub only — structural validation never calls this. */
export const unimplementedAnalysisProvider: AnalysisProvider = {
  id: "unimplemented-analysis",
  analyze() {
    return Promise.reject(
      new Error("AnalysisProvider is not implemented. No model analysis is wired."),
    );
  },
};
