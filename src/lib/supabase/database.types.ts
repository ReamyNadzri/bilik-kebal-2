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
          expires_at: string;
          id: string;
          token_hash: string;
          wanted_request_id: string;
        };
        Insert: {
          consumed_at?: string | null;
          created_at?: string;
          criteria_hash: string;
          expires_at: string;
          id?: string;
          token_hash: string;
          wanted_request_id: string;
        };
        Update: {
          consumed_at?: string | null;
          created_at?: string;
          criteria_hash?: string;
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
          language_id: string;
          policy_accepted_at: string;
          policy_version_snapshot: string | null;
          programme_id: string;
          public_id: string;
          published_at: string | null;
          requested_duration_days: number;
          resource_type_id: string;
          status: Database["public"]["Enums"]["wanted_status"];
          title: string;
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
          language_id: string;
          policy_accepted_at: string;
          policy_version_snapshot?: string | null;
          programme_id: string;
          public_id?: string;
          published_at?: string | null;
          requested_duration_days: number;
          resource_type_id: string;
          status?: Database["public"]["Enums"]["wanted_status"];
          title: string;
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
          language_id?: string;
          policy_accepted_at?: string;
          policy_version_snapshot?: string | null;
          programme_id?: string;
          public_id?: string;
          published_at?: string | null;
          requested_duration_days?: number;
          resource_type_id?: string;
          status?: Database["public"]["Enums"]["wanted_status"];
          title?: string;
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
      authorise_identity_evidence_read: {
        Args: { target_request_id: string };
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
      institution_role: "institution_sheriff";
      institution_verification_method: "domain" | "manual";
      institution_verification_state: "unverified" | "pending" | "verified" | "rejected";
      platform_role: "owner" | "platform_sheriff";
      verification_request_state: "pending" | "approved" | "rejected";
      wanted_access_basis: "contributors_only";
      wanted_status: "draft" | "awaiting_payment" | "open" | "reviewing" | "expired";
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
      institution_role: ["institution_sheriff"],
      institution_verification_method: ["domain", "manual"],
      institution_verification_state: ["unverified", "pending", "verified", "rejected"],
      platform_role: ["owner", "platform_sheriff"],
      verification_request_state: ["pending", "approved", "rejected"],
      wanted_access_basis: ["contributors_only"],
      wanted_status: ["draft", "awaiting_payment", "open", "reviewing", "expired"],
    },
  },
} as const;
