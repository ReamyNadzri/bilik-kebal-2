export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
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
      academic_sessions: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_sessions_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      account_restrictions: {
        Row: {
          expires_at: string | null;
          id: string;
          lifted_at: string | null;
          lifted_by: string | null;
          reason_code: string;
          restricted_at: string;
          restricted_by: string;
          user_id: string;
        };
        Insert: {
          expires_at?: string | null;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason_code: string;
          restricted_at?: string;
          restricted_by: string;
          user_id: string;
        };
        Update: {
          expires_at?: string | null;
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason_code?: string;
          restricted_at?: string;
          restricted_by?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_restrictions_lifted_by_fkey";
            columns: ["lifted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "account_restrictions_restricted_by_fkey";
            columns: ["restricted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "account_restrictions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      badge_awards: {
        Row: {
          awarded_at: string;
          awarded_by: string;
          badge_id: string;
          id: string;
          revoked_at: string | null;
          revoked_by: string | null;
          user_id: string;
        };
        Insert: {
          awarded_at?: string;
          awarded_by: string;
          badge_id: string;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          awarded_by?: string;
          badge_id?: string;
          id?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "badge_awards_awarded_by_fkey";
            columns: ["awarded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "badge_awards_badge_id_fkey";
            columns: ["badge_id"];
            isOneToOne: false;
            referencedRelation: "badges";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "badge_awards_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "badge_awards_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      badges: {
        Row: {
          created_at: string;
          created_by: string;
          description: string | null;
          id: string;
          image_object_key: string | null;
          name: string;
          retired_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          description?: string | null;
          id?: string;
          image_object_key?: string | null;
          name: string;
          retired_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          description?: string | null;
          id?: string;
          image_object_key?: string | null;
          name?: string;
          retired_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "badges_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      campuses: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          institution_id: string;
          latitude: number | null;
          longitude: number | null;
          map_x: number | null;
          map_y: number | null;
          name: string;
          region_open: boolean;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id: string;
          latitude?: number | null;
          longitude?: number | null;
          map_x?: number | null;
          map_y?: number | null;
          name: string;
          region_open?: boolean;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id?: string;
          latitude?: number | null;
          longitude?: number | null;
          map_x?: number | null;
          map_y?: number | null;
          name?: string;
          region_open?: boolean;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campuses_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_appeals: {
        Row: {
          appeal_deadline: string;
          appellant_user_id: string;
          claim_id: string;
          created_at: string;
          decided_at: string | null;
          decision: Database["public"]["Enums"]["claim_appeal_status"] | null;
          decision_notes: string | null;
          decision_reason_code: string | null;
          id: string;
          original_review_id: string;
          reason: string;
          reviewer_user_id: string | null;
          status: Database["public"]["Enums"]["claim_appeal_status"];
        };
        Insert: {
          appeal_deadline: string;
          appellant_user_id: string;
          claim_id: string;
          created_at?: string;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["claim_appeal_status"] | null;
          decision_notes?: string | null;
          decision_reason_code?: string | null;
          id?: string;
          original_review_id: string;
          reason: string;
          reviewer_user_id?: string | null;
          status?: Database["public"]["Enums"]["claim_appeal_status"];
        };
        Update: {
          appeal_deadline?: string;
          appellant_user_id?: string;
          claim_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decision?: Database["public"]["Enums"]["claim_appeal_status"] | null;
          decision_notes?: string | null;
          decision_reason_code?: string | null;
          id?: string;
          original_review_id?: string;
          reason?: string;
          reviewer_user_id?: string | null;
          status?: Database["public"]["Enums"]["claim_appeal_status"];
        };
        Relationships: [
          {
            foreignKeyName: "claim_appeals_appellant_user_id_fkey";
            columns: ["appellant_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "claim_appeals_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_appeals_original_review_id_fkey";
            columns: ["original_review_id"];
            isOneToOne: false;
            referencedRelation: "claim_reviews";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_appeals_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      claim_reports: {
        Row: {
          category: Database["public"]["Enums"]["claim_report_category"];
          claim_id: string;
          created_at: string;
          description: string;
          id: string;
          is_high_risk: boolean;
          reporter_user_id: string;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          status: Database["public"]["Enums"]["claim_report_status"];
        };
        Insert: {
          category: Database["public"]["Enums"]["claim_report_category"];
          claim_id: string;
          created_at?: string;
          description: string;
          id?: string;
          is_high_risk?: boolean;
          reporter_user_id: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          status?: Database["public"]["Enums"]["claim_report_status"];
        };
        Update: {
          category?: Database["public"]["Enums"]["claim_report_category"];
          claim_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          is_high_risk?: boolean;
          reporter_user_id?: string;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          status?: Database["public"]["Enums"]["claim_report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "claim_reports_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_reports_reporter_user_id_fkey";
            columns: ["reporter_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "claim_reports_resolved_by_user_id_fkey";
            columns: ["resolved_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      claim_reviews: {
        Row: {
          claim_id: string;
          created_at: string;
          decision: string;
          id: string;
          notes: string | null;
          reason_code: string;
          reviewer_user_id: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          decision: string;
          id?: string;
          notes?: string | null;
          reason_code: string;
          reviewer_user_id: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          decision?: string;
          id?: string;
          notes?: string | null;
          reason_code?: string;
          reviewer_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_reviews_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claim_reviews_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      claim_screening_jobs: {
        Row: {
          attempts: number;
          available_at: string;
          bucket: string;
          claim_id: string;
          completed_at: string | null;
          created_at: string;
          id: string;
          last_error_code: string | null;
          locked_at: string | null;
          mime_type: string;
          object_key: string;
          sha256: string;
          size_bytes: number;
          state: Database["public"]["Enums"]["claim_screening_job_state"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          available_at?: string;
          bucket: string;
          claim_id: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          last_error_code?: string | null;
          locked_at?: string | null;
          mime_type: string;
          object_key: string;
          sha256: string;
          size_bytes: number;
          state?: Database["public"]["Enums"]["claim_screening_job_state"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          available_at?: string;
          bucket?: string;
          claim_id?: string;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          last_error_code?: string | null;
          locked_at?: string | null;
          mime_type?: string;
          object_key?: string;
          sha256?: string;
          size_bytes?: number;
          state?: Database["public"]["Enums"]["claim_screening_job_state"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_screening_jobs_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_screening_results: {
        Row: {
          claim_id: string;
          completed_at: string;
          created_at: string;
          id: string;
          reason_codes: string[];
          result_hash: string;
          scanner_name: string;
          scanner_version: string;
          status: string;
        };
        Insert: {
          claim_id: string;
          completed_at: string;
          created_at?: string;
          id?: string;
          reason_codes?: string[];
          result_hash: string;
          scanner_name: string;
          scanner_version: string;
          status: string;
        };
        Update: {
          claim_id?: string;
          completed_at?: string;
          created_at?: string;
          id?: string;
          reason_codes?: string[];
          result_hash?: string;
          scanner_name?: string;
          scanner_version?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_screening_results_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
        ];
      };
      claim_upload_sessions: {
        Row: {
          claim_id: string;
          completed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          object_key: string;
        };
        Insert: {
          claim_id: string;
          completed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          object_key: string;
        };
        Update: {
          claim_id?: string;
          completed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          object_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claim_upload_sessions_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
        ];
      };
      claims: {
        Row: {
          bucket: string;
          created_at: string;
          file_name: string;
          free_release_opt_in: boolean;
          hunter_user_id: string;
          id: string;
          institution_id: string;
          is_restricted: boolean;
          mime_type: string;
          object_key: string;
          public_id: string;
          restriction_reason: string | null;
          rights_confirmed_at: string;
          sha256: string;
          size_bytes: number;
          status: Database["public"]["Enums"]["claim_status"];
          storage_provider: string;
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          file_name: string;
          free_release_opt_in?: boolean;
          hunter_user_id: string;
          id?: string;
          institution_id: string;
          is_restricted?: boolean;
          mime_type: string;
          object_key: string;
          public_id?: string;
          restriction_reason?: string | null;
          rights_confirmed_at: string;
          sha256: string;
          size_bytes: number;
          status?: Database["public"]["Enums"]["claim_status"];
          storage_provider?: string;
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          file_name?: string;
          free_release_opt_in?: boolean;
          hunter_user_id?: string;
          id?: string;
          institution_id?: string;
          is_restricted?: boolean;
          mime_type?: string;
          object_key?: string;
          public_id?: string;
          restriction_reason?: string | null;
          rights_confirmed_at?: string;
          sha256?: string;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["claim_status"];
          storage_provider?: string;
          updated_at?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "claims_hunter_user_id_fkey";
            columns: ["hunter_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "claims_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "claims_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      community_payout_requests: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decision_note: string | null;
          finder_user_id: string;
          id: string;
          note: string | null;
          requester_user_id: string;
          reviewer_user_id: string | null;
          status: string;
          wanted_request_id: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          finder_user_id: string;
          id?: string;
          note?: string | null;
          requester_user_id: string;
          reviewer_user_id?: string | null;
          status?: string;
          wanted_request_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          finder_user_id?: string;
          id?: string;
          note?: string | null;
          requester_user_id?: string;
          reviewer_user_id?: string | null;
          status?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_payout_requests_finder_user_id_fkey";
            columns: ["finder_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "community_payout_requests_requester_user_id_fkey";
            columns: ["requester_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "community_payout_requests_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "community_payout_requests_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      contribution_intents: {
        Row: {
          amount_sen: number;
          created_at: string;
          expires_at: string;
          fee_sen: number;
          id: string;
          paid_at: string | null;
          payer_user_id: string;
          provider: string;
          provider_bill_id: string;
          status: Database["public"]["Enums"]["contribution_intent_status"];
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          amount_sen: number;
          created_at?: string;
          expires_at: string;
          fee_sen?: number;
          id?: string;
          paid_at?: string | null;
          payer_user_id: string;
          provider: string;
          provider_bill_id: string;
          status?: Database["public"]["Enums"]["contribution_intent_status"];
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          amount_sen?: number;
          created_at?: string;
          expires_at?: string;
          fee_sen?: number;
          id?: string;
          paid_at?: string | null;
          payer_user_id?: string;
          provider?: string;
          provider_bill_id?: string;
          status?: Database["public"]["Enums"]["contribution_intent_status"];
          updated_at?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contribution_intents_payer_user_id_fkey";
            columns: ["payer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "contribution_intents_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      contributions: {
        Row: {
          amount_sen: number;
          contribution_intent_id: string;
          contributor_user_id: string;
          created_at: string;
          fee_sen: number;
          id: string;
          provider_event_id: string;
          wanted_request_id: string;
        };
        Insert: {
          amount_sen: number;
          contribution_intent_id: string;
          contributor_user_id: string;
          created_at?: string;
          fee_sen?: number;
          id?: string;
          provider_event_id: string;
          wanted_request_id: string;
        };
        Update: {
          amount_sen?: number;
          contribution_intent_id?: string;
          contributor_user_id?: string;
          created_at?: string;
          fee_sen?: number;
          id?: string;
          provider_event_id?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contributions_contribution_intent_id_fkey";
            columns: ["contribution_intent_id"];
            isOneToOne: true;
            referencedRelation: "contribution_intents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contributions_contributor_user_id_fkey";
            columns: ["contributor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "contributions_provider_event_id_fkey";
            columns: ["provider_event_id"];
            isOneToOne: true;
            referencedRelation: "provider_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contributions_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          id: string;
          institution_id: string;
          name: string;
          programme_id: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          id?: string;
          institution_id: string;
          name: string;
          programme_id: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          id?: string;
          institution_id?: string;
          name?: string;
          programme_id?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "courses_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "courses_programme_id_institution_id_fkey";
            columns: ["programme_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id", "institution_id"];
          },
        ];
      };
      duel_practice_shots: {
        Row: {
          created_at: string;
          foul: boolean;
          hit: boolean;
          id: string;
          level: string;
          reaction_ms: number | null;
          target_ms: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          foul?: boolean;
          hit: boolean;
          id?: string;
          level: string;
          reaction_ms?: number | null;
          target_ms: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          foul?: boolean;
          hit?: boolean;
          id?: string;
          level?: string;
          reaction_ms?: number | null;
          target_ms?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duel_practice_shots_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      duel_records: {
        Row: {
          best_reaction_ms: number | null;
          deaths: number;
          draws: number;
          kills: number;
          listed: boolean;
          reaction_count: number;
          reaction_sum_ms: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          best_reaction_ms?: number | null;
          deaths?: number;
          draws?: number;
          kills?: number;
          listed?: boolean;
          reaction_count?: number;
          reaction_sum_ms?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          best_reaction_ms?: number | null;
          deaths?: number;
          draws?: number;
          kills?: number;
          listed?: boolean;
          reaction_count?: number;
          reaction_sum_ms?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duel_records_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      duel_rounds: {
        Row: {
          challenger_id: string;
          finished_at: string | null;
          fouls: number | null;
          id: string;
          opponent_id: string;
          opponent_ms: number;
          outcome: string | null;
          reaction_ms: number | null;
          started_at: string;
        };
        Insert: {
          challenger_id: string;
          finished_at?: string | null;
          fouls?: number | null;
          id?: string;
          opponent_id: string;
          opponent_ms: number;
          outcome?: string | null;
          reaction_ms?: number | null;
          started_at?: string;
        };
        Update: {
          challenger_id?: string;
          finished_at?: string | null;
          fouls?: number | null;
          id?: string;
          opponent_id?: string;
          opponent_ms?: number;
          outcome?: string | null;
          reaction_ms?: number | null;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duel_rounds_challenger_id_fkey";
            columns: ["challenger_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "duel_rounds_opponent_id_fkey";
            columns: ["opponent_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      entitlements: {
        Row: {
          claim_id: string;
          granted_at: string;
          id: string;
          is_revoked: boolean;
          revocation_reason: string | null;
          revoked_at: string | null;
          user_id: string;
          wanted_request_id: string;
        };
        Insert: {
          claim_id: string;
          granted_at?: string;
          id?: string;
          is_revoked?: boolean;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          user_id: string;
          wanted_request_id: string;
        };
        Update: {
          claim_id?: string;
          granted_at?: string;
          id?: string;
          is_revoked?: boolean;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          user_id?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entitlements_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "entitlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "entitlements_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      faculties: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          institution_id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "faculties_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      identity_audit_events: {
        Row: {
          actor_user_id: string;
          details: Json;
          event_type: string;
          id: number;
          institution_id: string | null;
          occurred_at: string;
          subject_user_id: string | null;
        };
        Insert: {
          actor_user_id: string;
          details?: Json;
          event_type: string;
          id?: never;
          institution_id?: string | null;
          occurred_at?: string;
          subject_user_id?: string | null;
        };
        Update: {
          actor_user_id?: string;
          details?: Json;
          event_type?: string;
          id?: never;
          institution_id?: string | null;
          occurred_at?: string;
          subject_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "identity_audit_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "identity_audit_events_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "identity_audit_events_subject_user_id_fkey";
            columns: ["subject_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      institution_email_domains: {
        Row: {
          active: boolean;
          created_at: string;
          domain: string;
          institution_id: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          domain: string;
          institution_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          domain?: string;
          institution_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institution_email_domains_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      institution_memberships: {
        Row: {
          created_at: string;
          institution_id: string;
          updated_at: string;
          user_id: string;
          verification_method:
            Database["public"]["Enums"]["institution_verification_method"] | null;
          verification_state: Database["public"]["Enums"]["institution_verification_state"];
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          institution_id: string;
          updated_at?: string;
          user_id: string;
          verification_method?:
            Database["public"]["Enums"]["institution_verification_method"] | null;
          verification_state?: Database["public"]["Enums"]["institution_verification_state"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          institution_id?: string;
          updated_at?: string;
          user_id?: string;
          verification_method?:
            Database["public"]["Enums"]["institution_verification_method"] | null;
          verification_state?: Database["public"]["Enums"]["institution_verification_state"];
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "institution_memberships_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "institution_memberships_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "institution_memberships_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      institution_role_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          institution_id: string;
          role: Database["public"]["Enums"]["institution_role"];
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          institution_id: string;
          role: Database["public"]["Enums"]["institution_role"];
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          institution_id?: string;
          role?: Database["public"]["Enums"]["institution_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institution_role_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "institution_role_assignments_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "institution_role_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      institution_verification_requests: {
        Row: {
          created_at: string;
          decision_reason_code: string | null;
          evidence_delete_after: string;
          evidence_object_path: string;
          id: string;
          institution_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          state: Database["public"]["Enums"]["verification_request_state"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          decision_reason_code?: string | null;
          evidence_delete_after: string;
          evidence_object_path: string;
          id?: string;
          institution_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state?: Database["public"]["Enums"]["verification_request_state"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          decision_reason_code?: string | null;
          evidence_delete_after?: string;
          evidence_object_path?: string;
          id?: string;
          institution_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          state?: Database["public"]["Enums"]["verification_request_state"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "institution_verification_requests_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "institution_verification_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "institution_verification_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      institutions: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          short_name: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          short_name?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          short_name?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      languages: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          account_code: string;
          created_at: string;
          credit_sen: number;
          debit_sen: number;
          id: string;
          transaction_id: string;
        };
        Insert: {
          account_code: string;
          created_at?: string;
          credit_sen?: number;
          debit_sen?: number;
          id?: string;
          transaction_id: string;
        };
        Update: {
          account_code?: string;
          created_at?: string;
          credit_sen?: number;
          debit_sen?: number;
          id?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "ledger_transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_transactions: {
        Row: {
          contribution_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          payout_task_id: string | null;
          refund_task_id: string | null;
        };
        Insert: {
          contribution_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          payout_task_id?: string | null;
          refund_task_id?: string | null;
        };
        Update: {
          contribution_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          payout_task_id?: string | null;
          refund_task_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_contribution_id_fkey";
            columns: ["contribution_id"];
            isOneToOne: false;
            referencedRelation: "contributions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_payout_task_fk";
            columns: ["payout_task_id"];
            isOneToOne: false;
            referencedRelation: "payout_tasks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_transactions_refund_task_fk";
            columns: ["refund_task_id"];
            isOneToOne: false;
            referencedRelation: "refund_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      money_outbox: {
        Row: {
          aggregate_id: string;
          created_at: string;
          event_type: string;
          id: string;
          payload: Json;
          published_at: string | null;
        };
        Insert: {
          aggregate_id: string;
          created_at?: string;
          event_type: string;
          id?: string;
          payload: Json;
          published_at?: string | null;
        };
        Update: {
          aggregate_id?: string;
          created_at?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          published_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          kind: string;
          read_at: string | null;
          recipient_user_id: string;
          subject_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          kind: string;
          read_at?: string | null;
          recipient_user_id: string;
          subject_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          recipient_user_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      payout_tasks: {
        Row: {
          claim_id: string | null;
          community_payout_request_id: string | null;
          completed_at: string | null;
          created_at: string;
          evidence_notes: string | null;
          external_reference: string | null;
          fee_rate_basis_points: number;
          gross_bounty_sen: number;
          hunter_user_id: string;
          id: string;
          net_payout_sen: number;
          owner_user_id: string | null;
          payout_method: string | null;
          platform_fee_sen: number;
          status: Database["public"]["Enums"]["payout_task_status"];
          test_money: boolean;
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          claim_id?: string | null;
          community_payout_request_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          evidence_notes?: string | null;
          external_reference?: string | null;
          fee_rate_basis_points: number;
          gross_bounty_sen: number;
          hunter_user_id: string;
          id?: string;
          net_payout_sen: number;
          owner_user_id?: string | null;
          payout_method?: string | null;
          platform_fee_sen: number;
          status?: Database["public"]["Enums"]["payout_task_status"];
          test_money?: boolean;
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          claim_id?: string | null;
          community_payout_request_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          evidence_notes?: string | null;
          external_reference?: string | null;
          fee_rate_basis_points?: number;
          gross_bounty_sen?: number;
          hunter_user_id?: string;
          id?: string;
          net_payout_sen?: number;
          owner_user_id?: string | null;
          payout_method?: string | null;
          platform_fee_sen?: number;
          status?: Database["public"]["Enums"]["payout_task_status"];
          test_money?: boolean;
          updated_at?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_tasks_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_tasks_community_payout_request_id_fkey";
            columns: ["community_payout_request_id"];
            isOneToOne: true;
            referencedRelation: "community_payout_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_tasks_hunter_user_id_fkey";
            columns: ["hunter_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payout_tasks_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "payout_tasks_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: true;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_role_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          role: Database["public"]["Enums"]["platform_role"];
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          role?: Database["public"]["Enums"]["platform_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "platform_role_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "platform_role_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      privacy_requests: {
        Row: {
          answer: string | null;
          answered_at: string | null;
          answered_by: string | null;
          created_at: string;
          details: string;
          id: string;
          kind: string;
          status: string;
          user_id: string;
        };
        Insert: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          created_at?: string;
          details: string;
          id?: string;
          kind: string;
          status?: string;
          user_id: string;
        };
        Update: {
          answer?: string | null;
          answered_at?: string | null;
          answered_by?: string | null;
          created_at?: string;
          details?: string;
          id?: string;
          kind?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "privacy_requests_answered_by_fkey";
            columns: ["answered_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "privacy_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_object_key: string | null;
          avatar_preset: number | null;
          avatar_updated_at: string | null;
          bio: string | null;
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          display_name_changes: number;
          external_avatar_enabled: boolean;
          external_avatar_url: string | null;
          public_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_object_key?: string | null;
          avatar_preset?: number | null;
          avatar_updated_at?: string | null;
          bio?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name: string;
          display_name_changes?: number;
          external_avatar_enabled?: boolean;
          external_avatar_url?: string | null;
          public_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          avatar_object_key?: string | null;
          avatar_preset?: number | null;
          avatar_updated_at?: string | null;
          bio?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          display_name_changes?: number;
          external_avatar_enabled?: boolean;
          external_avatar_url?: string | null;
          public_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      programmes: {
        Row: {
          active: boolean;
          created_at: string;
          faculty_id: string;
          id: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          faculty_id: string;
          id?: string;
          institution_id: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          faculty_id?: string;
          id?: string;
          institution_id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programmes_faculty_id_institution_id_fkey";
            columns: ["faculty_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "faculties";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "programmes_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
        ];
      };
      provider_events: {
        Row: {
          amount_sen: number;
          id: string;
          payload_hash: string;
          processed_at: string | null;
          provider: string;
          provider_bill_id: string;
          provider_transaction_id: string;
          received_at: string;
          status: string;
        };
        Insert: {
          amount_sen: number;
          id?: string;
          payload_hash: string;
          processed_at?: string | null;
          provider: string;
          provider_bill_id: string;
          provider_transaction_id: string;
          received_at?: string;
          status: string;
        };
        Update: {
          amount_sen?: number;
          id?: string;
          payload_hash?: string;
          processed_at?: string | null;
          provider?: string;
          provider_bill_id?: string;
          provider_transaction_id?: string;
          received_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      refund_tasks: {
        Row: {
          amount_sen: number;
          completed_at: string | null;
          contribution_id: string;
          contributor_user_id: string;
          created_at: string;
          evidence_notes: string | null;
          external_reference: string | null;
          fee_sen: number;
          id: string;
          owner_user_id: string | null;
          refund_method: string | null;
          status: Database["public"]["Enums"]["refund_task_status"];
          test_money: boolean;
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          amount_sen: number;
          completed_at?: string | null;
          contribution_id: string;
          contributor_user_id: string;
          created_at?: string;
          evidence_notes?: string | null;
          external_reference?: string | null;
          fee_sen?: number;
          id?: string;
          owner_user_id?: string | null;
          refund_method?: string | null;
          status?: Database["public"]["Enums"]["refund_task_status"];
          test_money?: boolean;
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          amount_sen?: number;
          completed_at?: string | null;
          contribution_id?: string;
          contributor_user_id?: string;
          created_at?: string;
          evidence_notes?: string | null;
          external_reference?: string | null;
          fee_sen?: number;
          id?: string;
          owner_user_id?: string | null;
          refund_method?: string | null;
          status?: Database["public"]["Enums"]["refund_task_status"];
          test_money?: boolean;
          updated_at?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "refund_tasks_contribution_id_fkey";
            columns: ["contribution_id"];
            isOneToOne: true;
            referencedRelation: "contributions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refund_tasks_contributor_user_id_fkey";
            columns: ["contributor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "refund_tasks_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "refund_tasks_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_types: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      reward_code_redemptions: {
        Row: {
          credits: number;
          id: string;
          kind: string;
          redeemed_at: string;
          reward_code_id: string;
          user_id: string;
        };
        Insert: {
          credits: number;
          id?: string;
          kind?: string;
          redeemed_at?: string;
          reward_code_id: string;
          user_id: string;
        };
        Update: {
          credits?: number;
          id?: string;
          kind?: string;
          redeemed_at?: string;
          reward_code_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reward_code_redemptions_reward_code_id_fkey";
            columns: ["reward_code_id"];
            isOneToOne: false;
            referencedRelation: "reward_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reward_code_redemptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      reward_codes: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          created_by: string | null;
          credits_per_redemption: number;
          expires_at: string | null;
          id: string;
          kind: string;
          max_redemptions: number;
          redemption_count: number;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          created_by?: string | null;
          credits_per_redemption: number;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          max_redemptions: number;
          redemption_count?: number;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          credits_per_redemption?: number;
          expires_at?: string | null;
          id?: string;
          kind?: string;
          max_redemptions?: number;
          redemption_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reward_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      tags: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      taxonomy_requests: {
        Row: {
          category: string;
          course_code: string | null;
          created_at: string;
          created_item_id: string | null;
          decided_at: string | null;
          decision_note: string | null;
          id: string;
          institution_id: string;
          label: string;
          note: string | null;
          parent_faculty_id: string | null;
          parent_programme_id: string | null;
          requester_user_id: string;
          reviewer_user_id: string | null;
          status: string;
        };
        Insert: {
          category: string;
          course_code?: string | null;
          created_at?: string;
          created_item_id?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          institution_id: string;
          label: string;
          note?: string | null;
          parent_faculty_id?: string | null;
          parent_programme_id?: string | null;
          requester_user_id: string;
          reviewer_user_id?: string | null;
          status?: string;
        };
        Update: {
          category?: string;
          course_code?: string | null;
          created_at?: string;
          created_item_id?: string | null;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          institution_id?: string;
          label?: string;
          note?: string | null;
          parent_faculty_id?: string | null;
          parent_programme_id?: string | null;
          requester_user_id?: string;
          reviewer_user_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "taxonomy_requests_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "taxonomy_requests_parent_faculty_id_fkey";
            columns: ["parent_faculty_id"];
            isOneToOne: false;
            referencedRelation: "faculties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "taxonomy_requests_parent_programme_id_fkey";
            columns: ["parent_programme_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "taxonomy_requests_requester_user_id_fkey";
            columns: ["requester_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "taxonomy_requests_reviewer_user_id_fkey";
            columns: ["reviewer_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      terms_acceptances: {
        Row: {
          accepted_at: string;
          confirmed_adult: boolean;
          id: string;
          terms_version: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string;
          confirmed_adult: boolean;
          id?: string;
          terms_version: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string;
          confirmed_adult?: boolean;
          id?: string;
          terms_version?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_terms_version_fkey";
            columns: ["terms_version"];
            isOneToOne: false;
            referencedRelation: "terms_versions";
            referencedColumns: ["version"];
          },
          {
            foreignKeyName: "terms_acceptances_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      terms_versions: {
        Row: {
          created_at: string;
          effective_at: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          effective_at: string;
          version: string;
        };
        Update: {
          created_at?: string;
          effective_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      wanted_duplicate_checks: {
        Row: {
          consumed_at: string | null;
          created_at: string;
          criteria_hash: string;
          draft_updated_at: string | null;
          expires_at: string;
          id: string;
          token_hash: string;
          wanted_request_id: string;
        };
        Insert: {
          consumed_at?: string | null;
          created_at?: string;
          criteria_hash: string;
          draft_updated_at?: string | null;
          expires_at: string;
          id?: string;
          token_hash: string;
          wanted_request_id: string;
        };
        Update: {
          consumed_at?: string | null;
          created_at?: string;
          criteria_hash?: string;
          draft_updated_at?: string | null;
          expires_at?: string;
          id?: string;
          token_hash?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_duplicate_checks_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_pictures: {
        Row: {
          object_key: string | null;
          preset: number | null;
          set_by: string;
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          object_key?: string | null;
          preset?: number | null;
          set_by: string;
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          object_key?: string | null;
          preset?: number | null;
          set_by?: string;
          updated_at?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_pictures_set_by_fkey";
            columns: ["set_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_pictures_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: true;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_public_events: {
        Row: {
          event_type: string;
          id: string;
          occurred_at: string;
          summary: string;
          wanted_request_id: string;
        };
        Insert: {
          event_type: string;
          id?: string;
          occurred_at?: string;
          summary: string;
          wanted_request_id: string;
        };
        Update: {
          event_type?: string;
          id?: string;
          occurred_at?: string;
          summary?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_public_events_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_replies: {
        Row: {
          author_user_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          hidden_at: string | null;
          hidden_by: string | null;
          hidden_reason: string | null;
          id: string;
          parent_reply_id: string | null;
          wanted_request_id: string;
        };
        Insert: {
          author_user_id: string;
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          parent_reply_id?: string | null;
          wanted_request_id: string;
        };
        Update: {
          author_user_id?: string;
          body?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          hidden_at?: string | null;
          hidden_by?: string | null;
          hidden_reason?: string | null;
          id?: string;
          parent_reply_id?: string | null;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_replies_author_user_id_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_replies_hidden_by_fkey";
            columns: ["hidden_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_replies_parent_reply_id_fkey";
            columns: ["parent_reply_id"];
            isOneToOne: false;
            referencedRelation: "wanted_replies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wanted_replies_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_reports: {
        Row: {
          category: string;
          created_at: string;
          details: string | null;
          id: string;
          reporter_user_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          wanted_request_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reporter_user_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          wanted_request_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          details?: string | null;
          id?: string;
          reporter_user_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_reports_reporter_user_id_fkey";
            columns: ["reporter_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_reports_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_reports_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_request_revisions: {
        Row: {
          id: string;
          previous_description: string;
          previous_details: Json | null;
          previous_title: string;
          revised_at: string;
          revised_by: string;
          wanted_request_id: string;
        };
        Insert: {
          id?: string;
          previous_description: string;
          previous_details?: Json | null;
          previous_title: string;
          revised_at?: string;
          revised_by: string;
          wanted_request_id: string;
        };
        Update: {
          id?: string;
          previous_description?: string;
          previous_details?: Json | null;
          previous_title?: string;
          revised_at?: string;
          revised_by?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_request_revisions_revised_by_fkey";
            columns: ["revised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_request_revisions_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_request_tags: {
        Row: {
          tag_id: string;
          wanted_request_id: string;
        };
        Insert: {
          tag_id: string;
          wanted_request_id: string;
        };
        Update: {
          tag_id?: string;
          wanted_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_request_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wanted_request_tags_wanted_request_id_fkey";
            columns: ["wanted_request_id"];
            isOneToOne: false;
            referencedRelation: "wanted_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      wanted_requests: {
        Row: {
          academic_session_id: string | null;
          access_basis_snapshot: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id: string;
          closes_at: string | null;
          commissioner_user_id: string;
          course_id: string | null;
          created_at: string;
          description: string;
          duration_days_snapshot: number | null;
          faculty_id: string | null;
          fee_rate_basis_points_snapshot: number | null;
          id: string;
          institution_id: string;
          is_free: boolean;
          is_paused: boolean;
          kind: Database["public"]["Enums"]["wanted_kind"];
          language_id: string | null;
          last_seen_location: string | null;
          paused_at: string | null;
          policy_accepted_at: string;
          policy_version_snapshot: string | null;
          programme_id: string | null;
          public_id: string;
          published_at: string | null;
          removal_reason: string | null;
          removed_by_owner: string | null;
          requested_duration_days: number;
          resource_type_id: string | null;
          status: Database["public"]["Enums"]["wanted_status"];
          thread_auto_closed: boolean;
          thread_closed_at: string | null;
          thread_last_activity_at: string | null;
          thread_purged_at: string | null;
          thread_reply_count: number;
          title: string;
          total_paused_duration: string;
          updated_at: string;
          vanished_at: string | null;
          withdrawn_at: string | null;
        };
        Insert: {
          academic_session_id?: string | null;
          access_basis_snapshot?: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id: string;
          closes_at?: string | null;
          commissioner_user_id: string;
          course_id?: string | null;
          created_at?: string;
          description: string;
          duration_days_snapshot?: number | null;
          faculty_id?: string | null;
          fee_rate_basis_points_snapshot?: number | null;
          id?: string;
          institution_id: string;
          is_free?: boolean;
          is_paused?: boolean;
          kind?: Database["public"]["Enums"]["wanted_kind"];
          language_id?: string | null;
          last_seen_location?: string | null;
          paused_at?: string | null;
          policy_accepted_at: string;
          policy_version_snapshot?: string | null;
          programme_id?: string | null;
          public_id?: string;
          published_at?: string | null;
          removal_reason?: string | null;
          removed_by_owner?: string | null;
          requested_duration_days: number;
          resource_type_id?: string | null;
          status?: Database["public"]["Enums"]["wanted_status"];
          thread_auto_closed?: boolean;
          thread_closed_at?: string | null;
          thread_last_activity_at?: string | null;
          thread_purged_at?: string | null;
          thread_reply_count?: number;
          title: string;
          total_paused_duration?: string;
          updated_at?: string;
          vanished_at?: string | null;
          withdrawn_at?: string | null;
        };
        Update: {
          academic_session_id?: string | null;
          access_basis_snapshot?: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id?: string;
          closes_at?: string | null;
          commissioner_user_id?: string;
          course_id?: string | null;
          created_at?: string;
          description?: string;
          duration_days_snapshot?: number | null;
          faculty_id?: string | null;
          fee_rate_basis_points_snapshot?: number | null;
          id?: string;
          institution_id?: string;
          is_free?: boolean;
          is_paused?: boolean;
          kind?: Database["public"]["Enums"]["wanted_kind"];
          language_id?: string | null;
          last_seen_location?: string | null;
          paused_at?: string | null;
          policy_accepted_at?: string;
          policy_version_snapshot?: string | null;
          programme_id?: string | null;
          public_id?: string;
          published_at?: string | null;
          removal_reason?: string | null;
          removed_by_owner?: string | null;
          requested_duration_days?: number;
          resource_type_id?: string | null;
          status?: Database["public"]["Enums"]["wanted_status"];
          thread_auto_closed?: boolean;
          thread_closed_at?: string | null;
          thread_last_activity_at?: string | null;
          thread_purged_at?: string | null;
          thread_reply_count?: number;
          title?: string;
          total_paused_duration?: string;
          updated_at?: string;
          vanished_at?: string | null;
          withdrawn_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wanted_requests_academic_session_id_institution_id_fkey";
            columns: ["academic_session_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "academic_sessions";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "wanted_requests_campus_id_institution_id_fkey";
            columns: ["campus_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "campuses";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "wanted_requests_commissioner_user_id_fkey";
            columns: ["commissioner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_requests_course_id_institution_id_fkey";
            columns: ["course_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "wanted_requests_faculty_id_institution_id_fkey";
            columns: ["faculty_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "faculties";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "wanted_requests_institution_id_fkey";
            columns: ["institution_id"];
            isOneToOne: false;
            referencedRelation: "institutions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wanted_requests_language_id_fkey";
            columns: ["language_id"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wanted_requests_programme_id_institution_id_fkey";
            columns: ["programme_id", "institution_id"];
            isOneToOne: false;
            referencedRelation: "programmes";
            referencedColumns: ["id", "institution_id"];
          },
          {
            foreignKeyName: "wanted_requests_removed_by_owner_fkey";
            columns: ["removed_by_owner"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "wanted_requests_resource_type_id_fkey";
            columns: ["resource_type_id"];
            isOneToOne: false;
            referencedRelation: "resource_types";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_terms: {
        Args: { confirmed_adult: boolean; target_version: string };
        Returns: string;
      };
      answer_privacy_request: {
        Args: { target_answer: string; target_request_id: string };
        Returns: undefined;
      };
      approve_winning_claim_and_fulfill: {
        Args: {
          target_claim_id: string;
          target_notes?: string;
          target_reason_code: string;
        };
        Returns: string;
      };
      authorise_identity_evidence_read: {
        Args: { target_request_id: string };
        Returns: string;
      };
      backing_fee_rate: { Args: { target_public_id: string }; Returns: number };
      campus_region_totals: {
        Args: { target_institution_id: string };
        Returns: {
          id: string;
          latitude: number;
          longitude: number;
          map_x: number;
          map_y: number;
          name: string;
          open_bounty_sen: number;
          open_wanted_count: number;
          region_open: boolean;
        }[];
      };
      cancel_own_payment: {
        Args: { target_provider_bill_id: string };
        Returns: undefined;
      };
      claim_duel_achievement: { Args: { achievement_id: string }; Returns: string };
      claim_duel_topic: { Args: { topic: string }; Returns: string };
      claim_notification_email_batch: {
        Args: { batch_size?: number };
        Returns: {
          attempt: number;
          correlation_id: string;
          idempotency_expires_at: string;
          lease_token: string;
          notification_context: Json;
          notification_id: string;
          notification_kind: string;
          recipient_email: string;
        }[];
      };
      complete_claim_upload_session: {
        Args: { target_claim_id: string };
        Returns: {
          claim_id: string;
          completed_at: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          status: Database["public"]["Enums"]["claim_status"];
          wanted_id: string;
        }[];
      };
      console_lift_member_restriction: {
        Args: { target_public_id: string };
        Returns: undefined;
      };
      console_list_hidden_replies: {
        Args: { max_rows?: number };
        Returns: Json;
      };
      console_my_role: { Args: never; Returns: string };
      console_rename_member: {
        Args: {
          new_name: string;
          reason_code: string;
          target_public_id: string;
        };
        Returns: undefined;
      };
      console_reset_member_avatar: {
        Args: { reason_code: string; target_public_id: string };
        Returns: undefined;
      };
      console_restrict_member: {
        Args: { reason_code: string; target_public_id: string };
        Returns: string;
      };
      console_search_members: {
        Args: { max_rows?: number; search?: string };
        Returns: Json;
      };
      console_set_institution_verification: {
        Args: {
          reason_code: string;
          target_institution_id: string;
          target_public_id: string;
          verified: boolean;
        };
        Returns: undefined;
      };
      console_set_sheriff: {
        Args: {
          appoint: boolean;
          target_institution_id: string;
          target_public_id: string;
        };
        Returns: undefined;
      };
      console_timeout_member: {
        Args: {
          duration_hours: number;
          reason_code: string;
          target_public_id: string;
        };
        Returns: string;
      };
      create_backing_intent: {
        Args: {
          amount_sen: number;
          fee_sen: number;
          intent_expires_at: string;
          provider: string;
          provider_bill_id: string;
          target_public_id: string;
        };
        Returns: string;
      };
      create_badge: {
        Args: {
          badge_description?: string;
          badge_name: string;
          image_key?: string;
        };
        Returns: string;
      };
      create_claim_upload_session: {
        Args: {
          target_expires_at: string;
          target_file_name: string;
          target_free_release_opt_in: boolean;
          target_mime_type: string;
          target_object_key: string;
          target_sha256_hex: string;
          target_size_bytes: number;
          target_wanted_id: string;
        };
        Returns: {
          claim_id: string;
          object_key: string;
        }[];
      };
      create_community_draft: {
        Args: {
          target_campus_id: string;
          target_description: string;
          target_duration_days: number;
          target_kind: Database["public"]["Enums"]["wanted_kind"];
          target_last_seen_location: string;
          target_title: string;
        };
        Returns: string;
      };
      create_contribution_intent: {
        Args: {
          amount_sen: number;
          draft_id: string;
          fee_sen: number;
          intent_expires_at: string;
          provider: string;
          provider_bill_id: string;
          token_hash_hex: string;
        };
        Returns: string;
      };
      create_reward_code: {
        Args: {
          target_code: string;
          target_credits: number;
          target_expires_at?: string;
          target_kind?: string;
          target_max_redemptions: number;
        };
        Returns: string;
      };
      create_wanted_draft: {
        Args: {
          academic_session_id: string;
          campus_id: string;
          course_id: string;
          description: string;
          duration_days: number;
          faculty_id: string;
          language_id: string;
          programme_id: string;
          resource_type_id: string;
          tag_ids: string[];
          title: string;
        };
        Returns: string;
      };
      current_account: { Args: never; Returns: Json };
      current_identity: {
        Args: never;
        Returns: {
          created_at: string;
          email: string;
          email_verified_at: string;
          public_id: string;
          user_id: string;
        }[];
      };
      decide_community_payout: {
        Args: {
          approve: boolean;
          target_note?: string;
          target_request_id: string;
        };
        Returns: string;
      };
      decide_taxonomy_request: {
        Args: {
          approve: boolean;
          open_region?: boolean;
          target_note?: string;
          target_request_id: string;
        };
        Returns: string;
      };
      delete_own_account: { Args: never; Returns: string };
      delete_own_wanted_reply: {
        Args: { target_reply_id: string };
        Returns: undefined;
      };
      dismiss_wanted_report: {
        Args: { target_report_id: string };
        Returns: undefined;
      };
      duel_achievements_this_month: { Args: never; Returns: Json };
      duel_leaderboard: { Args: never; Returns: Json };
      duel_record: { Args: never; Returns: Json };
      edit_own_wanted_reply: {
        Args: { new_body: string; target_reply_id: string };
        Returns: undefined;
      };
      enqueue_notification: {
        Args: {
          target_event_id: string;
          target_kind: string;
          target_recipient_id: string;
          target_subject_id: string;
        };
        Returns: string;
      };
      ensure_course: {
        Args: { target_code: string; target_programme_id: string };
        Returns: string;
      };
      ensure_tag: { Args: { target_name: string }; Returns: string };
      expire_wanted_and_generate_refunds: {
        Args: { target_wanted_id: string };
        Returns: number;
      };
      finish_duel: {
        Args: { fouls: number; reaction_ms: number; round_id: string };
        Returns: Json;
      };
      lift_account_restriction: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      list_duel_opponents: { Args: never; Returns: Json };
      list_notifications: {
        Args: {
          before_created_at?: string;
          before_id?: string;
          page_size?: number;
        };
        Returns: Json;
      };
      list_own_backed_wanted: {
        Args: never;
        Returns: {
          backed_at: string;
          contributed_sen: number;
          kind: string;
          public_id: string;
          refund_sen: number;
          refund_state: string;
          removed: boolean;
          status: string;
          title: string;
          withdrawn: boolean;
        }[];
      };
      list_privacy_requests: {
        Args: { target_status?: string };
        Returns: {
          answer: string;
          answered_at: string;
          created_at: string;
          details: string;
          id: string;
          kind: string;
          member_display_name: string;
          member_public_id: string;
          status: string;
        }[];
      };
      list_public_hunters: {
        Args: { page: number; page_size: number };
        Returns: Json;
      };
      list_public_hunters_at: {
        Args: { page: number; page_size: number; target_institution_id: string };
        Returns: Json;
      };
      list_unresolved_provider_events: {
        Args: { max_rows?: number };
        Returns: {
          id: string;
          provider: string;
          provider_bill_id: string;
          provider_transaction_id: string;
          reason: string;
          received_at: string;
        }[];
      };
      list_wanted_reports: {
        Args: { target_status?: string };
        Returns: {
          category: string;
          created_at: string;
          details: string;
          id: string;
          report_count: number;
          status: string;
          wanted_public_id: string;
          wanted_status: string;
          wanted_title: string;
        }[];
      };
      mark_all_notifications_read: { Args: never; Returns: number };
      mark_notification_email_sent: {
        Args: {
          target_lease_token: string;
          target_notification_id: string;
          target_provider_message_id: string;
        };
        Returns: boolean;
      };
      mark_notification_read: {
        Args: { target_notification_id: string };
        Returns: boolean;
      };
      move_notification_email_to_review: {
        Args: {
          review_reason: string;
          target_lease_token: string;
          target_notification_id: string;
        };
        Returns: boolean;
      };
      my_display_name_allowance: {
        Args: never;
        Returns: {
          base: number;
          bonus: number;
          remaining: number;
          used: number;
        }[];
      };
      my_free_request_allowance: {
        Args: never;
        Returns: {
          base: number;
          bonus: number;
          remaining: number;
          used: number;
        }[];
      };
      my_payment_bill: {
        Args: { target_provider_bill_id: string };
        Returns: {
          amount_sen: number;
          expires_at: string;
          fee_sen: number;
          paid_at: string;
          provider: string;
          provider_bill_id: string;
          purpose: string;
          status: Database["public"]["Enums"]["contribution_intent_status"];
          wanted_public_id: string;
          wanted_status: Database["public"]["Enums"]["wanted_status"];
          wanted_title: string;
        }[];
      };
      my_payment_details: {
        Args: never;
        Returns: {
          account_holder_name: string;
          account_number_last4: string;
          bank_code: string;
          phone_e164: string;
          updated_at: string;
        }[];
      };
      my_wanted_change_window: {
        Args: { target_public_id: string };
        Returns: {
          editable_until: string;
          locked_reason: string;
        }[];
      };
      owner_payment_recipients: {
        Args: { target_user_ids: string[] };
        Returns: {
          account_holder_name: string;
          account_number: string;
          bank_code: string;
          phone_e164: string;
          user_id: string;
        }[];
      };
      owner_remove_wanted: {
        Args: { target_public_id: string; target_reason: string };
        Returns: Json;
      };
      post_wanted_reply: {
        Args: {
          parent_reply?: string;
          reply_body: string;
          target_public_id: string;
        };
        Returns: string;
      };
      publish_community_wanted: {
        Args: {
          target_campus_id: string;
          target_description: string;
          target_duration_days: number;
          target_kind: Database["public"]["Enums"]["wanted_kind"];
          target_last_seen_location: string;
          target_policy_version: string;
          target_title: string;
        };
        Returns: string;
      };
      publish_free_wanted: {
        Args: {
          target_criteria_hash_hex: string;
          target_draft_id: string;
          target_policy_version: string;
          target_token_hash_hex: string;
        };
        Returns: string;
      };
      record_claim_appeal_decision: {
        Args: {
          target_appeal_id: string;
          target_decision: Database["public"]["Enums"]["claim_appeal_status"];
          target_notes?: string;
          target_reason_code: string;
        };
        Returns: undefined;
      };
      record_claim_review: {
        Args: {
          target_claim_id: string;
          target_decision: string;
          target_notes?: string;
          target_reason_code: string;
        };
        Returns: string;
      };
      record_duel_practice: {
        Args: { foul: boolean; level: string; reaction_ms: number };
        Returns: Json;
      };
      record_notification_email_failure: {
        Args: {
          is_retryable: boolean;
          safe_error_code: string;
          target_lease_token: string;
          target_notification_id: string;
        };
        Returns: string;
      };
      record_owner_payout_completion: {
        Args: {
          target_external_ref: string;
          target_method: string;
          target_notes?: string;
          target_payout_task_id: string;
        };
        Returns: undefined;
      };
      record_owner_refund_completion: {
        Args: {
          target_external_ref: string;
          target_method: string;
          target_notes?: string;
          target_refund_task_id: string;
        };
        Returns: undefined;
      };
      record_verified_contribution: {
        Args: {
          amount_sen: number;
          payload_hash_hex: string;
          provider_bill_id: string;
          provider_name: string;
          provider_status: string;
          provider_transaction_id: string;
        };
        Returns: string;
      };
      record_wanted_duplicate_check: {
        Args: {
          criteria_hash_hex: string;
          draft_id: string;
          expires_at: string;
          token_hash_hex: string;
        };
        Returns: undefined;
      };
      redeem_reward_code: { Args: { target_code: string }; Returns: string };
      remove_wanted_picture: {
        Args: { reason_code: string; target_wanted_ref: string };
        Returns: undefined;
      };
      reopen_own_community_wanted: {
        Args: { target_public_id: string };
        Returns: undefined;
      };
      report_wanted: {
        Args: {
          target_category: string;
          target_details?: string;
          target_public_id: string;
        };
        Returns: string;
      };
      request_community_payout: {
        Args: {
          finder_public_id: string;
          target_note?: string;
          target_public_id: string;
        };
        Returns: string;
      };
      reset_duel_record: { Args: never; Returns: undefined };
      resolve_own_community_wanted: {
        Args: { target_public_id: string };
        Returns: undefined;
      };
      restrict_account: {
        Args: { reason_code: string; target_user_id: string };
        Returns: string;
      };
      retire_badge: { Args: { target_badge_id: string }; Returns: undefined };
      review_claim_file_access: {
        Args: { target_claim_id: string; target_purpose: string };
        Returns: {
          bucket: string;
          file_name: string;
          mime_type: string;
          object_key: string;
        }[];
      };
      review_institution_verification_request: {
        Args: {
          decision: Database["public"]["Enums"]["verification_request_state"];
          reason_code: string;
          target_request_id: string;
        };
        Returns: string;
      };
      revoke_entitlements_for_wanted: {
        Args: { target_reason: string; target_wanted_id: string };
        Returns: number;
      };
      set_duel_listing: { Args: { listed: boolean }; Returns: boolean };
      set_member_badge: {
        Args: { target_badge_id: string; target_public_id: string };
        Returns: undefined;
      };
      set_own_avatar: { Args: { new_object_key: string }; Returns: undefined };
      set_own_avatar_preset: {
        Args: { new_preset: number };
        Returns: undefined;
      };
      set_own_payment_details: {
        Args: {
          new_account_holder_name: string;
          new_account_number: string;
          new_bank_code: string;
          new_phone_e164: string;
        };
        Returns: undefined;
      };
      set_own_wanted_picture: {
        Args: {
          new_object_key?: string;
          new_preset?: number;
          target_wanted_ref: string;
        };
        Returns: undefined;
      };
      set_wanted_reply_hidden: {
        Args: { hide: boolean; reason_code?: string; target_reply_id: string };
        Returns: undefined;
      };
      start_duel: { Args: { opponent_public_id: string }; Returns: Json };
      submit_claim_appeal: {
        Args: { target_claim_id: string; target_reason: string };
        Returns: string;
      };
      submit_claim_report: {
        Args: {
          target_category: Database["public"]["Enums"]["claim_report_category"];
          target_claim_id: string;
          target_description: string;
        };
        Returns: string;
      };
      submit_privacy_request: {
        Args: { target_details: string; target_kind: string };
        Returns: string;
      };
      submit_taxonomy_request: {
        Args: {
          target_category: string;
          target_course_code?: string;
          target_label: string;
          target_note?: string;
          target_parent_id?: string;
        };
        Returns: string;
      };
      sync_clerk_avatar: {
        Args: {
          target_avatar_url: string;
          target_clerk_updated_at: string;
          target_clerk_user_id: string;
        };
        Returns: undefined;
      };
      sync_clerk_user: {
        Args: {
          target_clerk_updated_at: string;
          target_clerk_user_id: string;
          target_display_name: string;
          target_email: string;
          target_email_verified: boolean;
          target_external_id: string;
        };
        Returns: string;
      };
      timeout_account: {
        Args: {
          duration_hours: number;
          reason_code: string;
          target_user_id: string;
        };
        Returns: string;
      };
      update_own_profile: {
        Args: { new_bio: string; new_display_name: string };
        Returns: undefined;
      };
      update_own_published_wanted: {
        Args: {
          new_description: string;
          new_title: string;
          target_public_id: string;
        };
        Returns: undefined;
      };
      update_own_published_wanted_details: {
        Args: {
          new_academic_session_id: string;
          new_campus_id: string;
          new_course_id: string;
          new_description: string;
          new_faculty_id: string;
          new_language_id: string;
          new_last_seen_location: string;
          new_programme_id: string;
          new_resource_type_id: string;
          new_tag_ids: string[];
          new_title: string;
          target_public_id: string;
        };
        Returns: undefined;
      };
      update_wanted_draft: {
        Args: {
          academic_session_id: string;
          campus_id: string;
          course_id: string;
          description: string;
          draft_id: string;
          duration_days: number;
          faculty_id: string;
          language_id: string;
          programme_id: string;
          resource_type_id: string;
          tag_ids: string[];
          title: string;
        };
        Returns: string;
      };
      use_own_external_avatar: { Args: never; Returns: string };
      verify_own_institution_by_domain: { Args: never; Returns: string };
      withdraw_own_wanted: {
        Args: { target_public_id: string };
        Returns: number;
      };
    };
    Enums: {
      claim_appeal_status: "pending" | "upheld" | "overturned" | "dismissed";
      claim_report_category:
        | "restricted_material"
        | "rights_issue"
        | "wrong_file"
        | "personal_data"
        | "malware"
        | "fraud"
        | "other";
      claim_report_status: "pending" | "investigating" | "resolved" | "dismissed";
      claim_screening_job_state: "queued" | "processing" | "completed" | "failed";
      claim_status:
        | "uploading"
        | "screening"
        | "needs_information"
        | "under_review"
        | "approved"
        | "not_selected"
        | "rejected"
        | "withdrawn"
        | "restricted"
        | "appeal_pending";
      contribution_intent_status: "pending" | "paid" | "failed" | "expired";
      institution_role: "institution_sheriff";
      institution_verification_method: "domain" | "manual";
      institution_verification_state: "unverified" | "pending" | "verified" | "rejected";
      payout_task_status: "pending" | "processing" | "completed" | "failed";
      platform_role: "owner" | "platform_sheriff";
      refund_task_status: "pending" | "processing" | "completed" | "failed";
      verification_request_state: "pending" | "approved" | "rejected";
      wanted_access_basis: "contributors_only" | "commissioner_free";
      wanted_kind: "academic" | "missing_item" | "discussion";
      wanted_status:
        | "draft"
        | "awaiting_payment"
        | "open"
        | "reviewing"
        | "expired"
        | "fulfilled"
        | "closed"
        | "withdrawn";
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
      claim_appeal_status: ["pending", "upheld", "overturned", "dismissed"],
      claim_report_category: [
        "restricted_material",
        "rights_issue",
        "wrong_file",
        "personal_data",
        "malware",
        "fraud",
        "other",
      ],
      claim_report_status: ["pending", "investigating", "resolved", "dismissed"],
      claim_screening_job_state: ["queued", "processing", "completed", "failed"],
      claim_status: [
        "uploading",
        "screening",
        "needs_information",
        "under_review",
        "approved",
        "not_selected",
        "rejected",
        "withdrawn",
        "restricted",
        "appeal_pending",
      ],
      contribution_intent_status: ["pending", "paid", "failed", "expired"],
      institution_role: ["institution_sheriff"],
      institution_verification_method: ["domain", "manual"],
      institution_verification_state: ["unverified", "pending", "verified", "rejected"],
      payout_task_status: ["pending", "processing", "completed", "failed"],
      platform_role: ["owner", "platform_sheriff"],
      refund_task_status: ["pending", "processing", "completed", "failed"],
      verification_request_state: ["pending", "approved", "rejected"],
      wanted_access_basis: ["contributors_only", "commissioner_free"],
      wanted_kind: ["academic", "missing_item", "discussion"],
      wanted_status: [
        "draft",
        "awaiting_payment",
        "open",
        "reviewing",
        "expired",
        "fulfilled",
        "closed",
        "withdrawn",
      ],
    },
  },
} as const;
