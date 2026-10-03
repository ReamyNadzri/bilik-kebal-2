import type { Database as GeneratedDatabase } from "./database.types";

export type { Enums, Json, Tables, TablesInsert, TablesUpdate } from "./database.types";

/**
 * Function arguments the database accepts as SQL null on purpose. Postgres
 * cannot declare a function parameter NOT NULL, so `supabase gen types` types
 * every argument without a default as non-null and every defaulted one as
 * optional; these are the arguments whose functions treat null as a value
 * ("no session", "no note", "all universities"). Listed here rather than
 * edited into `database.types.ts`, so regenerating that file loses nothing;
 * an entry naming a function or argument that no longer exists fails to compile.
 */
type NullableArgs = KnownArgs<{
  campus_region_totals: "target_institution_id";
  console_search_members: "search";
  console_set_sheriff: "target_institution_id";
  create_badge: "badge_description" | "image_key";
  create_wanted_draft: "academic_session_id";
  decide_community_payout: "target_note";
  decide_taxonomy_request: "target_note";
  post_wanted_reply: "parent_reply";
  publish_community_wanted: "target_last_seen_location";
  report_wanted: "target_details";
  request_community_payout: "target_note";
  set_member_badge: "target_badge_id";
  set_own_avatar: "new_object_key";
  set_own_avatar_preset: "new_preset";
  set_own_wanted_picture: "new_object_key" | "new_preset";
  set_wanted_reply_hidden: "reason_code";
  submit_taxonomy_request: "target_course_code" | "target_note" | "target_parent_id";
  sync_clerk_avatar: "target_avatar_url";
  sync_clerk_user: "target_display_name" | "target_email" | "target_external_id";
  update_own_profile: "new_bio";
  update_own_published_wanted_details:
    | "new_academic_session_id"
    | "new_course_id"
    | "new_faculty_id"
    | "new_language_id"
    | "new_last_seen_location"
    | "new_programme_id"
    | "new_resource_type_id";
  update_wanted_draft: "academic_session_id";
}>;

type PublicFunctions = GeneratedDatabase["public"]["Functions"];

type KnownArgs<
  T extends {
    [F in keyof T]: F extends keyof PublicFunctions ? keyof PublicFunctions[F]["Args"] : never;
  },
> = T;

type WithNullable<Args, Names> = {
  [P in keyof Args]: P extends Names ? Args[P] | null : Args[P];
};

type PatchedFunctions = {
  [F in keyof PublicFunctions]: F extends keyof NullableArgs
    ? {
        [K in keyof PublicFunctions[F]]: K extends "Args"
          ? WithNullable<PublicFunctions[F][K], NullableArgs[F]>
          : PublicFunctions[F][K];
      }
    : PublicFunctions[F];
};

/**
 * Tables and functions of migrations not yet applied to the linked project,
 * so not yet in `database.types.ts`. Shapes are what `supabase gen types`
 * produces for them on a local database. Once the migration is applied and the
 * types are regenerated, an entry here that the generated file now has fails
 * to compile: delete it then.
 *
 * Pending: 202610200007_terms_acceptance_and_privacy_requests.
 */
type PendingTables = {
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
    Row: { created_at: string; effective_at: string; version: string };
    Insert: { created_at?: string; effective_at: string; version: string };
    Update: { created_at?: string; effective_at?: string; version?: string };
    Relationships: [];
  };
};

type PendingFunctions = {
  accept_terms: { Args: { confirmed_adult: boolean; target_version: string }; Returns: string };
  answer_privacy_request: {
    Args: { target_answer: string; target_request_id: string };
    Returns: undefined;
  };
  list_privacy_requests: {
    Args: { target_status?: string };
    Returns: {
      answer: string | null;
      answered_at: string | null;
      created_at: string;
      details: string;
      id: string;
      kind: string;
      member_display_name: string;
      member_public_id: string;
      status: string;
    }[];
  };
  submit_privacy_request: {
    Args: { target_details: string; target_kind: string };
    Returns: string;
  };
};

/** `Overlap` must be empty: a pending name the generated types already have fails here. */
type NotYetGenerated<Pending, Overlap extends never> = [Overlap] extends [never] ? Pending : never;

type GeneratedTables = GeneratedDatabase["public"]["Tables"];
type AddedTables = NotYetGenerated<PendingTables, keyof PendingTables & keyof GeneratedTables>;
type AddedFunctions = NotYetGenerated<
  PendingFunctions,
  keyof PendingFunctions & keyof PublicFunctions
>;

/**
 * The generated `Database`, with the nullable function arguments and the
 * pending tables and functions above. Type every Supabase client with this one.
 */
export type Database = {
  [S in keyof GeneratedDatabase]: S extends "public"
    ? {
        [K in keyof GeneratedDatabase["public"]]: K extends "Functions"
          ? {
              [F in keyof PatchedFunctions | keyof AddedFunctions]: F extends keyof PatchedFunctions
                ? PatchedFunctions[F]
                : F extends keyof AddedFunctions
                  ? AddedFunctions[F]
                  : never;
            }
          : K extends "Tables"
            ? {
                [T in keyof GeneratedTables | keyof AddedTables]: T extends keyof GeneratedTables
                  ? GeneratedTables[T]
                  : T extends keyof AddedTables
                    ? AddedTables[T]
                    : never;
              }
            : GeneratedDatabase["public"][K];
      }
    : GeneratedDatabase[S];
};
