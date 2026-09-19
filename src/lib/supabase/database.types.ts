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
          mime_type: string;
          object_key: string;
          public_id: string;
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
          mime_type: string;
          object_key: string;
          public_id?: string;
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
          mime_type?: string;
          object_key?: string;
          public_id?: string;
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
        };
        Insert: {
          contribution_id?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
        };
        Update: {
          contribution_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_contribution_id_fkey";
            columns: ["contribution_id"];
            isOneToOne: true;
            referencedRelation: "contributions";
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
      claim_status:
        | "uploading"
        | "screening"
        | "needs_information"
        | "under_review"
        | "approved"
        | "not_selected"
        | "rejected"
        | "withdrawn";
      contribution_intent_status: "pending" | "paid" | "failed" | "expired";
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
      claim_status: [
        "uploading",
        "screening",
        "needs_information",
        "under_review",
        "approved",
        "not_selected",
        "rejected",
        "withdrawn",
      ],
      contribution_intent_status: ["pending", "paid", "failed", "expired"],
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
