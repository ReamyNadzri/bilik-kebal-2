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
          id: string;
          lifted_at: string | null;
          lifted_by: string | null;
          reason_code: string;
          restricted_at: string;
          restricted_by: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          lifted_at?: string | null;
          lifted_by?: string | null;
          reason_code: string;
          restricted_at?: string;
          restricted_by: string;
          user_id: string;
        };
        Update: {
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
      campuses: {
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
      contribution_intents: {
        Row: {
          amount_sen: number;
          created_at: string;
          expires_at: string;
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
          id: string;
          provider_event_id: string;
          wanted_request_id: string;
        };
        Insert: {
          amount_sen: number;
          contribution_intent_id: string;
          contributor_user_id: string;
          created_at?: string;
          id?: string;
          provider_event_id: string;
          wanted_request_id: string;
        };
        Update: {
          amount_sen?: number;
          contribution_intent_id?: string;
          contributor_user_id?: string;
          created_at?: string;
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
          slug: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
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
      payout_tasks: {
        Row: {
          claim_id: string;
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
          updated_at: string;
          wanted_request_id: string;
        };
        Insert: {
          claim_id: string;
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
          updated_at?: string;
          wanted_request_id: string;
        };
        Update: {
          claim_id?: string;
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
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
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
          id: string;
          owner_user_id: string | null;
          refund_method: string | null;
          status: Database["public"]["Enums"]["refund_task_status"];
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
          id?: string;
          owner_user_id?: string | null;
          refund_method?: string | null;
          status?: Database["public"]["Enums"]["refund_task_status"];
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
          id?: string;
          owner_user_id?: string | null;
          refund_method?: string | null;
          status?: Database["public"]["Enums"]["refund_task_status"];
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
          academic_session_id: string;
          access_basis_snapshot: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id: string;
          closes_at: string | null;
          commissioner_user_id: string;
          course_id: string;
          created_at: string;
          description: string;
          duration_days_snapshot: number | null;
          faculty_id: string;
          fee_rate_basis_points_snapshot: number | null;
          id: string;
          institution_id: string;
          is_paused: boolean;
          language_id: string;
          paused_at: string | null;
          policy_accepted_at: string;
          policy_version_snapshot: string | null;
          programme_id: string;
          public_id: string;
          published_at: string | null;
          requested_duration_days: number;
          resource_type_id: string;
          status: Database["public"]["Enums"]["wanted_status"];
          title: string;
          total_paused_duration: string;
          updated_at: string;
        };
        Insert: {
          academic_session_id: string;
          access_basis_snapshot?: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id: string;
          closes_at?: string | null;
          commissioner_user_id: string;
          course_id: string;
          created_at?: string;
          description: string;
          duration_days_snapshot?: number | null;
          faculty_id: string;
          fee_rate_basis_points_snapshot?: number | null;
          id?: string;
          institution_id: string;
          is_paused?: boolean;
          language_id: string;
          paused_at?: string | null;
          policy_accepted_at: string;
          policy_version_snapshot?: string | null;
          programme_id: string;
          public_id?: string;
          published_at?: string | null;
          requested_duration_days: number;
          resource_type_id: string;
          status?: Database["public"]["Enums"]["wanted_status"];
          title: string;
          total_paused_duration?: string;
          updated_at?: string;
        };
        Update: {
          academic_session_id?: string;
          access_basis_snapshot?: Database["public"]["Enums"]["wanted_access_basis"] | null;
          campus_id?: string;
          closes_at?: string | null;
          commissioner_user_id?: string;
          course_id?: string;
          created_at?: string;
          description?: string;
          duration_days_snapshot?: number | null;
          faculty_id?: string;
          fee_rate_basis_points_snapshot?: number | null;
          id?: string;
          institution_id?: string;
          is_paused?: boolean;
          language_id?: string;
          paused_at?: string | null;
          policy_accepted_at?: string;
          policy_version_snapshot?: string | null;
          programme_id?: string;
          public_id?: string;
          published_at?: string | null;
          requested_duration_days?: number;
          resource_type_id?: string;
          status?: Database["public"]["Enums"]["wanted_status"];
          title?: string;
          total_paused_duration?: string;
          updated_at?: string;
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
      create_contribution_intent: {
        Args: {
          amount_sen: number;
          draft_id: string;
          intent_expires_at: string;
          provider: string;
          provider_bill_id: string;
          token_hash_hex: string;
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
      expire_wanted_and_generate_refunds: {
        Args: { target_wanted_id: string };
        Returns: number;
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
      restrict_account: {
        Args: { reason_code: string; target_user_id: string };
        Returns: string;
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
      verify_own_institution_by_domain: { Args: never; Returns: string };
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
      wanted_access_basis: "contributors_only";
      wanted_status:
        "draft" | "awaiting_payment" | "open" | "reviewing" | "expired" | "fulfilled" | "closed";
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
      wanted_access_basis: ["contributors_only"],
      wanted_status: [
        "draft",
        "awaiting_payment",
        "open",
        "reviewing",
        "expired",
        "fulfilled",
        "closed",
      ],
    },
  },
} as const;
