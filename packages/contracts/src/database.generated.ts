/**
 * Generated Database types for Supabase.
 *
 * Regenerate with: `pnpm db:types`
 * Do not hand-edit this file.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      agents: {
        Row: {
          created_at: string;
          id: string;
          metadata: Json;
          name: string;
          provider: string;
          type: Database["public"]["Enums"]["agent_type"];
          updated_at: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          name: string;
          provider: string;
          type: Database["public"]["Enums"]["agent_type"];
          updated_at?: string;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          provider?: string;
          type?: Database["public"]["Enums"]["agent_type"];
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      artifacts: {
        Row: {
          byte_size: number;
          content_hash: string;
          content_type: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["artifact_kind"];
          organization_id: string;
          storage_key: string | null;
        };
        Insert: {
          byte_size: number;
          content_hash: string;
          content_type: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["artifact_kind"];
          organization_id: string;
          storage_key?: string | null;
        };
        Update: {
          byte_size?: number;
          content_hash?: string;
          content_type?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["artifact_kind"];
          organization_id?: string;
          storage_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "artifacts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          project_id: string | null;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          project_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_events_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      benchmark_versions: {
        Row: {
          benchmark_id: string;
          created_at: string;
          id: string;
          manifest: Json;
          version: string;
        };
        Insert: {
          benchmark_id: string;
          created_at?: string;
          id?: string;
          manifest?: Json;
          version: string;
        };
        Update: {
          benchmark_id?: string;
          created_at?: string;
          id?: string;
          manifest?: Json;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "benchmark_versions_benchmark_id_fkey";
            columns: ["benchmark_id"];
            isOneToOne: false;
            referencedRelation: "benchmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      benchmarks: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          key: string;
          name: string;
          provider: string;
          status: Database["public"]["Enums"]["benchmark_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key: string;
          name: string;
          provider: string;
          status?: Database["public"]["Enums"]["benchmark_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          key?: string;
          name?: string;
          provider?: string;
          status?: Database["public"]["Enums"]["benchmark_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_customers: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          stripe_customer_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          stripe_customer_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          stripe_customer_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_customers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      billing_subscriptions: {
        Row: {
          billing_customer_id: string;
          created_at: string;
          current_period_end: string | null;
          id: string;
          organization_id: string;
          price_id: string | null;
          status: string;
          stripe_subscription_id: string;
          updated_at: string;
        };
        Insert: {
          billing_customer_id: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id: string;
          price_id?: string | null;
          status: string;
          stripe_subscription_id: string;
          updated_at?: string;
        };
        Update: {
          billing_customer_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id?: string;
          price_id?: string | null;
          status?: string;
          stripe_subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_subscriptions_billing_customer_id_fkey";
            columns: ["billing_customer_id"];
            isOneToOne: false;
            referencedRelation: "billing_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "billing_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      dataset_members: {
        Row: {
          dataset_version_id: string;
          environment_version_id: string | null;
          evaluation_run_id: string | null;
          id: string;
          review_id: string | null;
          task_version_id: string | null;
        };
        Insert: {
          dataset_version_id: string;
          environment_version_id?: string | null;
          evaluation_run_id?: string | null;
          id?: string;
          review_id?: string | null;
          task_version_id?: string | null;
        };
        Update: {
          dataset_version_id?: string;
          environment_version_id?: string | null;
          evaluation_run_id?: string | null;
          id?: string;
          review_id?: string | null;
          task_version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dataset_members_dataset_version_id_fkey";
            columns: ["dataset_version_id"];
            isOneToOne: false;
            referencedRelation: "dataset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dataset_members_environment_version_id_fkey";
            columns: ["environment_version_id"];
            isOneToOne: false;
            referencedRelation: "environment_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dataset_members_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dataset_members_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dataset_members_task_version_id_fkey";
            columns: ["task_version_id"];
            isOneToOne: false;
            referencedRelation: "task_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      dataset_versions: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          organization_id: string;
          privacy_class: Database["public"]["Enums"]["privacy_class"];
          version: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          organization_id: string;
          privacy_class?: Database["public"]["Enums"]["privacy_class"];
          version: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          privacy_class?: Database["public"]["Enums"]["privacy_class"];
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dataset_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      environment_versions: {
        Row: {
          adapter_id: string;
          created_at: string;
          id: string;
          organization_id: string;
          spec: Json;
          version: string;
        };
        Insert: {
          adapter_id: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          spec?: Json;
          version: string;
        };
        Update: {
          adapter_id?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          spec?: Json;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "environment_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_scenarios: {
        Row: {
          authoring_source: string;
          created_at: string;
          created_by: string;
          difficulty: string;
          expected_outcome: Json;
          id: string;
          key: string;
          name: string;
          organization_id: string;
          project_id: string;
          request_text: string;
          starting_state: Json;
          trusted: boolean;
          verifier_pointer: string | null;
        };
        Insert: {
          authoring_source: string;
          created_at?: string;
          created_by: string;
          difficulty: string;
          expected_outcome?: Json;
          id?: string;
          key: string;
          name: string;
          organization_id: string;
          project_id: string;
          request_text: string;
          starting_state?: Json;
          trusted?: boolean;
          verifier_pointer?: string | null;
        };
        Update: {
          authoring_source?: string;
          created_at?: string;
          created_by?: string;
          difficulty?: string;
          expected_outcome?: Json;
          id?: string;
          key?: string;
          name?: string;
          organization_id?: string;
          project_id?: string;
          request_text?: string;
          starting_state?: Json;
          trusted?: boolean;
          verifier_pointer?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "eval_scenarios_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "eval_scenarios_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_gates: {
        Row: {
          created_at: string;
          id: string;
          metric: string;
          min_value: number;
          suite_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          metric: string;
          min_value: number;
          suite_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          metric?: string;
          min_value?: number;
          suite_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_gates_suite_id_fkey";
            columns: ["suite_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_suites";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          evaluation_run_id: string;
          heartbeat_at: string | null;
          id: string;
          last_error: string | null;
          organization_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          evaluation_run_id: string;
          heartbeat_at?: string | null;
          id?: string;
          last_error?: string | null;
          organization_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          available_at?: string;
          claimed_at?: string | null;
          claimed_by?: string | null;
          created_at?: string;
          evaluation_run_id?: string;
          heartbeat_at?: string | null;
          id?: string;
          last_error?: string | null;
          organization_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_jobs_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: true;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_results: {
        Row: {
          created_at: string;
          evaluation_run_id: string;
          id: string;
          payload: Json;
          result_kind: Database["public"]["Enums"]["evaluation_result_kind"];
        };
        Insert: {
          created_at?: string;
          evaluation_run_id: string;
          id?: string;
          payload?: Json;
          result_kind: Database["public"]["Enums"]["evaluation_result_kind"];
        };
        Update: {
          created_at?: string;
          evaluation_run_id?: string;
          id?: string;
          payload?: Json;
          result_kind?: Database["public"]["Enums"]["evaluation_result_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_results_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_runs: {
        Row: {
          agent_config_hash: string | null;
          agent_git_sha: string | null;
          agent_id: string | null;
          benchmark_version_id: string;
          completed_at: string | null;
          created_at: string;
          environment_version_id: string | null;
          eval_scenario_id: string | null;
          evaluator_configuration: Json;
          id: string;
          organization_id: string;
          project_id: string;
          run_number: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["evaluation_run_status"];
          submission_id: string;
          suite_run_id: string | null;
          task_version_id: string;
        };
        Insert: {
          agent_config_hash?: string | null;
          agent_git_sha?: string | null;
          agent_id?: string | null;
          benchmark_version_id: string;
          completed_at?: string | null;
          created_at?: string;
          environment_version_id?: string | null;
          eval_scenario_id?: string | null;
          evaluator_configuration?: Json;
          id?: string;
          organization_id: string;
          project_id: string;
          run_number: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["evaluation_run_status"];
          submission_id: string;
          suite_run_id?: string | null;
          task_version_id: string;
        };
        Update: {
          agent_config_hash?: string | null;
          agent_git_sha?: string | null;
          agent_id?: string | null;
          benchmark_version_id?: string;
          completed_at?: string | null;
          created_at?: string;
          environment_version_id?: string | null;
          eval_scenario_id?: string | null;
          evaluator_configuration?: Json;
          id?: string;
          organization_id?: string;
          project_id?: string;
          run_number?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["evaluation_run_status"];
          submission_id?: string;
          suite_run_id?: string | null;
          task_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_runs_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_benchmark_version_id_fkey";
            columns: ["benchmark_version_id"];
            isOneToOne: false;
            referencedRelation: "benchmark_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_environment_version_id_fkey";
            columns: ["environment_version_id"];
            isOneToOne: false;
            referencedRelation: "environment_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_eval_scenario_id_fkey";
            columns: ["eval_scenario_id"];
            isOneToOne: false;
            referencedRelation: "eval_scenarios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_suite_run_id_fkey";
            columns: ["suite_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_suite_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_runs_task_version_id_fkey";
            columns: ["task_version_id"];
            isOneToOne: false;
            referencedRelation: "task_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_suite_members: {
        Row: {
          ordinal: number;
          suite_id: string;
          task_version_id: string;
        };
        Insert: {
          ordinal: number;
          suite_id: string;
          task_version_id: string;
        };
        Update: {
          ordinal?: number;
          suite_id?: string;
          task_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_suite_members_suite_id_fkey";
            columns: ["suite_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_suites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_suite_members_task_version_id_fkey";
            columns: ["task_version_id"];
            isOneToOne: false;
            referencedRelation: "task_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_suite_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          gate_passed: boolean | null;
          id: string;
          organization_id: string;
          project_id: string;
          status: string;
          suite_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          gate_passed?: boolean | null;
          id?: string;
          organization_id: string;
          project_id: string;
          status?: string;
          suite_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          gate_passed?: boolean | null;
          id?: string;
          organization_id?: string;
          project_id?: string;
          status?: string;
          suite_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_suite_runs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_suite_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_suite_runs_suite_id_fkey";
            columns: ["suite_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_suites";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_suites: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_suites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_trials: {
        Row: {
          attempt_index: number;
          completed_at: string | null;
          completion_tokens: number | null;
          cost_usd: number | null;
          created_at: string;
          evaluation_run_id: string;
          failure_category: string | null;
          id: string;
          latency_ms: number | null;
          log_artifact_id: string | null;
          metrics: Json;
          model_id: string | null;
          model_provider: string | null;
          model_snapshot: string | null;
          organization_id: string;
          prompt_tokens: number | null;
          reward: number | null;
          started_at: string | null;
          status: string;
          trajectory_artifact_id: string | null;
        };
        Insert: {
          attempt_index: number;
          completed_at?: string | null;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          evaluation_run_id: string;
          failure_category?: string | null;
          id?: string;
          latency_ms?: number | null;
          log_artifact_id?: string | null;
          metrics?: Json;
          model_id?: string | null;
          model_provider?: string | null;
          model_snapshot?: string | null;
          organization_id: string;
          prompt_tokens?: number | null;
          reward?: number | null;
          started_at?: string | null;
          status?: string;
          trajectory_artifact_id?: string | null;
        };
        Update: {
          attempt_index?: number;
          completed_at?: string | null;
          completion_tokens?: number | null;
          cost_usd?: number | null;
          created_at?: string;
          evaluation_run_id?: string;
          failure_category?: string | null;
          id?: string;
          latency_ms?: number | null;
          log_artifact_id?: string | null;
          metrics?: Json;
          model_id?: string | null;
          model_provider?: string | null;
          model_snapshot?: string | null;
          organization_id?: string;
          prompt_tokens?: number | null;
          reward?: number | null;
          started_at?: string | null;
          status?: string;
          trajectory_artifact_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_trials_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_trials_log_artifact_id_fkey";
            columns: ["log_artifact_id"];
            isOneToOne: false;
            referencedRelation: "artifacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_trials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_trials_trajectory_artifact_id_fkey";
            columns: ["trajectory_artifact_id"];
            isOneToOne: false;
            referencedRelation: "artifacts";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_workflow_memberships: {
        Row: {
          created_at: string;
          organization_id: string;
          user_id: string;
          workflow_role: Database["public"]["Enums"]["workflow_role"];
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          user_id: string;
          workflow_role: Database["public"]["Enums"]["workflow_role"];
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          user_id?: string;
          workflow_role?: Database["public"]["Enums"]["workflow_role"];
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_workflow_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      finding_reviews: {
        Row: {
          created_at: string;
          decision: Database["public"]["Enums"]["finding_review_decision"];
          evidence: Json;
          finding_id: string;
          id: string;
          organization_id: string;
          rationale: string;
          reviewer_id: string;
          round: number;
          submitted_at: string;
        };
        Insert: {
          created_at?: string;
          decision: Database["public"]["Enums"]["finding_review_decision"];
          evidence?: Json;
          finding_id: string;
          id?: string;
          organization_id: string;
          rationale: string;
          reviewer_id: string;
          round?: number;
          submitted_at?: string;
        };
        Update: {
          created_at?: string;
          decision?: Database["public"]["Enums"]["finding_review_decision"];
          evidence?: Json;
          finding_id?: string;
          id?: string;
          organization_id?: string;
          rationale?: string;
          reviewer_id?: string;
          round?: number;
          submitted_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finding_reviews_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finding_reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      findings: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          evidence: Json;
          id: string;
          recommendation: string | null;
          review_id: string;
          severity: Database["public"]["Enums"]["finding_severity"];
          source: Database["public"]["Enums"]["finding_source"];
          status: Database["public"]["Enums"]["finding_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          evidence?: Json;
          id?: string;
          recommendation?: string | null;
          review_id: string;
          severity: Database["public"]["Enums"]["finding_severity"];
          source: Database["public"]["Enums"]["finding_source"];
          status?: Database["public"]["Enums"]["finding_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          evidence?: Json;
          id?: string;
          recommendation?: string | null;
          review_id?: string;
          severity?: Database["public"]["Enums"]["finding_severity"];
          source?: Database["public"]["Enums"]["finding_source"];
          status?: Database["public"]["Enums"]["finding_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "findings_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_memberships: {
        Row: {
          created_at: string;
          organization_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          organization_id: string;
          role: Database["public"]["Enums"]["organization_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["organization_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          eval_concurrency_limit: number;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          eval_concurrency_limit?: number;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          eval_concurrency_limit?: number;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          archived_at: string | null;
          benchmark_id: string | null;
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          slug: string;
          status: Database["public"]["Enums"]["project_status"];
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          benchmark_id?: string | null;
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          slug: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          benchmark_id?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["project_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_benchmark_id_fkey";
            columns: ["benchmark_id"];
            isOneToOne: false;
            referencedRelation: "benchmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          created_at: string;
          created_by: string;
          evaluation_run_id: string | null;
          id: string;
          organization_id: string;
          project_id: string | null;
          status: Database["public"]["Enums"]["review_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          evaluation_run_id?: string | null;
          id?: string;
          organization_id: string;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          evaluation_run_id?: string | null;
          id?: string;
          organization_id?: string;
          project_id?: string | null;
          status?: Database["public"]["Enums"]["review_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      rollouts: {
        Row: {
          agent_id: string | null;
          created_at: string;
          environment_version_id: string;
          evaluation_run_id: string | null;
          id: string;
          organization_id: string;
          reward: number | null;
          seed: number;
          task_version_id: string;
        };
        Insert: {
          agent_id?: string | null;
          created_at?: string;
          environment_version_id: string;
          evaluation_run_id?: string | null;
          id?: string;
          organization_id: string;
          reward?: number | null;
          seed?: number;
          task_version_id: string;
        };
        Update: {
          agent_id?: string | null;
          created_at?: string;
          environment_version_id?: string;
          evaluation_run_id?: string | null;
          id?: string;
          organization_id?: string;
          reward?: number | null;
          seed?: number;
          task_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rollouts_agent_id_fkey";
            columns: ["agent_id"];
            isOneToOne: false;
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rollouts_environment_version_id_fkey";
            columns: ["environment_version_id"];
            isOneToOne: false;
            referencedRelation: "environment_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rollouts_evaluation_run_id_fkey";
            columns: ["evaluation_run_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_runs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rollouts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rollouts_task_version_id_fkey";
            columns: ["task_version_id"];
            isOneToOne: false;
            referencedRelation: "task_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      submissions: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          kind: Database["public"]["Enums"]["submission_kind"];
          metadata: Json;
          project_id: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          kind: Database["public"]["Enums"]["submission_kind"];
          metadata?: Json;
          project_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["submission_kind"];
          metadata?: Json;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "submissions_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      task_versions: {
        Row: {
          created_at: string;
          id: string;
          task_id: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          task_id: string;
          version: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          task_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "task_versions_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          benchmark_version_id: string;
          created_at: string;
          description: string | null;
          external_key: string;
          id: string;
          metadata: Json;
          name: string;
          updated_at: string;
        };
        Insert: {
          benchmark_version_id: string;
          created_at?: string;
          description?: string | null;
          external_key: string;
          id?: string;
          metadata?: Json;
          name: string;
          updated_at?: string;
        };
        Update: {
          benchmark_version_id?: string;
          created_at?: string;
          description?: string | null;
          external_key?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_benchmark_version_id_fkey";
            columns: ["benchmark_version_id"];
            isOneToOne: false;
            referencedRelation: "benchmark_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_experiment_tasks: {
        Row: {
          experiment_id: string;
          split: string;
          task_version_id: string;
        };
        Insert: {
          experiment_id: string;
          split: string;
          task_version_id: string;
        };
        Update: {
          experiment_id?: string;
          split?: string;
          task_version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "training_experiment_tasks_experiment_id_fkey";
            columns: ["experiment_id"];
            isOneToOne: false;
            referencedRelation: "training_experiments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_experiment_tasks_task_version_id_fkey";
            columns: ["task_version_id"];
            isOneToOne: false;
            referencedRelation: "task_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_experiments: {
        Row: {
          checkpoint_ref: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          git_sha: string | null;
          held_out_task_count: number;
          id: string;
          metrics: Json;
          name: string;
          notes: string | null;
          organization_id: string;
          parent_experiment_id: string | null;
          project_id: string | null;
          reward_recipe: string;
          split_seed: number;
          stage: string;
          status: string;
          train_task_count: number;
        };
        Insert: {
          checkpoint_ref?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          git_sha?: string | null;
          held_out_task_count?: number;
          id?: string;
          metrics?: Json;
          name: string;
          notes?: string | null;
          organization_id: string;
          parent_experiment_id?: string | null;
          project_id?: string | null;
          reward_recipe?: string;
          split_seed?: number;
          stage: string;
          status?: string;
          train_task_count?: number;
        };
        Update: {
          checkpoint_ref?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          git_sha?: string | null;
          held_out_task_count?: number;
          id?: string;
          metrics?: Json;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          parent_experiment_id?: string | null;
          project_id?: string | null;
          reward_recipe?: string;
          split_seed?: number;
          stage?: string;
          status?: string;
          train_task_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_experiments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_experiments_parent_experiment_id_fkey";
            columns: ["parent_experiment_id"];
            isOneToOne: false;
            referencedRelation: "training_experiments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_experiments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_findings: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          evidence: Json;
          fingerprint: string;
          id: string;
          message: string;
          ordinal: number;
          remediation: string | null;
          severity: Database["public"]["Enums"]["validation_finding_severity"];
          title: string;
          validation_run_id: string;
          validator_id: string | null;
        };
        Insert: {
          category: string;
          code: string;
          created_at?: string;
          evidence?: Json;
          fingerprint: string;
          id?: string;
          message: string;
          ordinal: number;
          remediation?: string | null;
          severity: Database["public"]["Enums"]["validation_finding_severity"];
          title: string;
          validation_run_id: string;
          validator_id?: string | null;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          evidence?: Json;
          fingerprint?: string;
          id?: string;
          message?: string;
          ordinal?: number;
          remediation?: string | null;
          severity?: Database["public"]["Enums"]["validation_finding_severity"];
          title?: string;
          validation_run_id?: string;
          validator_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "validation_findings_validation_run_id_fkey";
            columns: ["validation_run_id"];
            isOneToOne: false;
            referencedRelation: "validation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_run_files: {
        Row: {
          byte_size: number;
          created_at: string;
          id: string;
          path: string;
          validation_run_id: string;
        };
        Insert: {
          byte_size: number;
          created_at?: string;
          id?: string;
          path: string;
          validation_run_id: string;
        };
        Update: {
          byte_size?: number;
          created_at?: string;
          id?: string;
          path?: string;
          validation_run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_run_files_validation_run_id_fkey";
            columns: ["validation_run_id"];
            isOneToOne: false;
            referencedRelation: "validation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_run_tasks: {
        Row: {
          created_at: string;
          external_key: string;
          id: string;
          name: string;
          ordinal: number;
          root_path: string;
          slug: string;
          task_version: string | null;
          validation_run_id: string;
        };
        Insert: {
          created_at?: string;
          external_key: string;
          id?: string;
          name: string;
          ordinal: number;
          root_path: string;
          slug: string;
          task_version?: string | null;
          validation_run_id: string;
        };
        Update: {
          created_at?: string;
          external_key?: string;
          id?: string;
          name?: string;
          ordinal?: number;
          root_path?: string;
          slug?: string;
          task_version?: string | null;
          validation_run_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_run_tasks_validation_run_id_fkey";
            columns: ["validation_run_id"];
            isOneToOne: false;
            referencedRelation: "validation_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_runs: {
        Row: {
          adapter_id: string | null;
          adapter_version: string | null;
          artifact_content_hash: string | null;
          artifact_id: string;
          benchmark_id: string | null;
          benchmark_version_id: string | null;
          completed_at: string | null;
          configuration: Json;
          created_at: string;
          critical_count: number;
          duration_ms: number | null;
          error_count: number;
          error_message: string | null;
          id: string;
          info_count: number;
          outcome: string | null;
          policy: string;
          project_id: string;
          run_number: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["validation_run_status"];
          submission_id: string | null;
          task_version: string | null;
          validator_error_count: number;
          validators: Json;
          warning_count: number;
        };
        Insert: {
          adapter_id?: string | null;
          adapter_version?: string | null;
          artifact_content_hash?: string | null;
          artifact_id: string;
          benchmark_id?: string | null;
          benchmark_version_id?: string | null;
          completed_at?: string | null;
          configuration?: Json;
          created_at?: string;
          critical_count?: number;
          duration_ms?: number | null;
          error_count?: number;
          error_message?: string | null;
          id?: string;
          info_count?: number;
          outcome?: string | null;
          policy?: string;
          project_id: string;
          run_number?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["validation_run_status"];
          submission_id?: string | null;
          task_version?: string | null;
          validator_error_count?: number;
          validators?: Json;
          warning_count?: number;
        };
        Update: {
          adapter_id?: string | null;
          adapter_version?: string | null;
          artifact_content_hash?: string | null;
          artifact_id?: string;
          benchmark_id?: string | null;
          benchmark_version_id?: string | null;
          completed_at?: string | null;
          configuration?: Json;
          created_at?: string;
          critical_count?: number;
          duration_ms?: number | null;
          error_count?: number;
          error_message?: string | null;
          id?: string;
          info_count?: number;
          outcome?: string | null;
          policy?: string;
          project_id?: string;
          run_number?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["validation_run_status"];
          submission_id?: string | null;
          task_version?: string | null;
          validator_error_count?: number;
          validators?: Json;
          warning_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "validation_runs_artifact_id_fkey";
            columns: ["artifact_id"];
            isOneToOne: false;
            referencedRelation: "artifacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_runs_benchmark_id_fkey";
            columns: ["benchmark_id"];
            isOneToOne: false;
            referencedRelation: "benchmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_runs_benchmark_version_id_fkey";
            columns: ["benchmark_version_id"];
            isOneToOne: false;
            referencedRelation: "benchmark_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_runs_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_runs_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          created_at: string;
          endpoint_id: string;
          event: string;
          id: string;
          last_error: string | null;
          organization_id: string;
          payload: Json;
          signature: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          endpoint_id: string;
          event: string;
          id?: string;
          last_error?: string | null;
          organization_id: string;
          payload?: Json;
          signature: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          endpoint_id?: string;
          event?: string;
          id?: string;
          last_error?: string | null;
          organization_id?: string;
          payload?: Json;
          signature?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey";
            columns: ["endpoint_id"];
            isOneToOne: false;
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_deliveries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_endpoint_secrets: {
        Row: {
          endpoint_id: string;
          secret: string;
        };
        Insert: {
          endpoint_id: string;
          secret: string;
        };
        Update: {
          endpoint_id?: string;
          secret?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_endpoint_secrets_endpoint_id_fkey";
            columns: ["endpoint_id"];
            isOneToOne: true;
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_endpoints: {
        Row: {
          created_at: string;
          created_by: string;
          events: string[];
          id: string;
          is_active: boolean;
          organization_id: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          events: string[];
          id?: string;
          is_active?: boolean;
          organization_id: string;
          url: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          events?: string[];
          id?: string;
          is_active?: boolean;
          organization_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      cancel_evaluation_run: {
        Args: { p_run_id: string };
        Returns: {
          agent_config_hash: string | null;
          agent_git_sha: string | null;
          agent_id: string | null;
          benchmark_version_id: string;
          completed_at: string | null;
          created_at: string;
          environment_version_id: string | null;
          eval_scenario_id: string | null;
          evaluator_configuration: Json;
          id: string;
          organization_id: string;
          project_id: string;
          run_number: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["evaluation_run_status"];
          submission_id: string;
          suite_run_id: string | null;
          task_version_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "evaluation_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_evaluation_job: {
        Args: { p_worker_id: string };
        Returns: {
          attempt_count: number;
          available_at: string;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          evaluation_run_id: string;
          heartbeat_at: string | null;
          id: string;
          last_error: string | null;
          organization_id: string;
          status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "evaluation_jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_webhook_endpoint: {
        Args: { p_events: string[]; p_organization_id: string; p_url: string };
        Returns: Json;
      };
      enqueue_evaluation: {
        Args: {
          p_agent_id: string;
          p_benchmark_version_id: string;
          p_evaluator_configuration: Json;
          p_kind: Database["public"]["Enums"]["submission_kind"];
          p_metadata: Json;
          p_project_id: string;
          p_task_version_id: string;
        };
        Returns: {
          agent_config_hash: string | null;
          agent_git_sha: string | null;
          agent_id: string | null;
          benchmark_version_id: string;
          completed_at: string | null;
          created_at: string;
          environment_version_id: string | null;
          eval_scenario_id: string | null;
          evaluator_configuration: Json;
          id: string;
          organization_id: string;
          project_id: string;
          run_number: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["evaluation_run_status"];
          submission_id: string;
          suite_run_id: string | null;
          task_version_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "evaluation_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      enqueue_evaluation_suite: {
        Args: {
          p_agent_id: string;
          p_evaluator_configuration: Json;
          p_project_id: string;
          p_suite_id: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          gate_passed: boolean | null;
          id: string;
          organization_id: string;
          project_id: string;
          status: string;
          suite_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "evaluation_suite_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      enqueue_held_out_evaluations: {
        Args: { p_experiment_id: string };
        Returns: Json;
      };
      ensure_personal_organization: {
        Args: never;
        Returns: {
          created_at: string;
          created_by: string;
          eval_concurrency_limit: number;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      heartbeat_evaluation_job: {
        Args: { p_job_id: string; p_worker_id: string };
        Returns: {
          attempt_count: number;
          available_at: string;
          claimed_at: string | null;
          claimed_by: string | null;
          created_at: string;
          evaluation_run_id: string;
          heartbeat_at: string | null;
          id: string;
          last_error: string | null;
          organization_id: string;
          status: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "evaluation_jobs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      on_evaluation_run_terminal: {
        Args: { p_run_id: string };
        Returns: undefined;
      };
      queue_webhook_deliveries: {
        Args: { p_event: string; p_organization_id: string; p_payload: Json };
        Returns: undefined;
      };
      reclaim_stale_evaluation_jobs: {
        Args: { p_lease_seconds?: number };
        Returns: number;
      };
      refresh_training_experiment_metrics: {
        Args: { p_experiment_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      agent_type: "model" | "harness" | "composite";
      artifact_kind: "archive" | "log" | "trace" | "image" | "json" | "other";
      benchmark_status: "draft" | "published" | "retired";
      evaluation_result_kind: "score" | "pass_fail" | "raw" | "other";
      evaluation_run_status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
      finding_review_decision: "accept" | "reject" | "comment";
      finding_severity: "info" | "low" | "medium" | "high" | "critical";
      finding_source: "human" | "system" | "adapter";
      finding_status: "open" | "acknowledged" | "resolved" | "dismissed";
      organization_role: "owner" | "admin" | "member";
      privacy_class: "PRIVATE" | "INTERNAL" | "RESTRICTED";
      project_status: "active" | "archived";
      review_status: "open" | "resolved" | "dismissed";
      submission_kind:
        | "uploaded_archive"
        | "git_repository"
        | "git_commit"
        | "generated_task"
        | "benchmark_provided"
        | "internal_package";
      validation_finding_severity: "info" | "warning" | "error" | "critical";
      validation_run_status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
      workflow_role: "reviewer" | "adjudicator";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_type: ["model", "harness", "composite"],
      artifact_kind: ["archive", "log", "trace", "image", "json", "other"],
      benchmark_status: ["draft", "published", "retired"],
      evaluation_result_kind: ["score", "pass_fail", "raw", "other"],
      evaluation_run_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      finding_review_decision: ["accept", "reject", "comment"],
      finding_severity: ["info", "low", "medium", "high", "critical"],
      finding_source: ["human", "system", "adapter"],
      finding_status: ["open", "acknowledged", "resolved", "dismissed"],
      organization_role: ["owner", "admin", "member"],
      privacy_class: ["PRIVATE", "INTERNAL", "RESTRICTED"],
      project_status: ["active", "archived"],
      review_status: ["open", "resolved", "dismissed"],
      submission_kind: [
        "uploaded_archive",
        "git_repository",
        "git_commit",
        "generated_task",
        "benchmark_provided",
        "internal_package",
      ],
      validation_finding_severity: ["info", "warning", "error", "critical"],
      validation_run_status: ["queued", "running", "succeeded", "failed", "cancelled"],
      workflow_role: ["reviewer", "adjudicator"],
    },
  },
} as const;
