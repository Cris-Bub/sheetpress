// Hand-rolled Database types for the SaaS-fork schema.
//
// Regenerate with:
//   supabase gen types typescript --local > lib/supabase/types.ts
//
// Until the CLI is wired up locally, this file is the source of truth for
// what the Supabase clients believe about the schema. Keep it in sync with
// supabase/migrations/*.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          created_at?: string;
        };
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          active_profile_id: string | null;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'member';
          active_profile_id?: string | null;
          created_at?: string;
        };
        Update: {
          role?: 'owner' | 'admin' | 'member';
          active_profile_id?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          workspace_id: string;
          business_name: string;
          legal_name: string | null;
          tax_id: string | null;
          tax_id_label: string | null;
          email: string;
          phone: string | null;
          address: Json;
          logo_data_url: string | null;
          default_payment_instructions: string | null;
          default_payment_terms_days: number;
          default_notes: string | null;
          default_currency: string;
          default_tax_rate: number | null;
          accent_color: string;
          invoice_number_format: string;
          next_invoice_number: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'workspace_id' | 'created_at'>>;
      };
      clients: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          contact_name: string | null;
          email: string | null;
          tax_id: string | null;
          address: Json | null;
          default_currency: string | null;
          notes: string | null;
          created_at: string;
          archived_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'workspace_id' | 'created_at'>>;
      };
      invoices: {
        Row: {
          id: string;
          workspace_id: string;
          profile_id: string;
          client_id: string | null;
          number: string;
          issue_date: string;
          due_date: string;
          currency: string;
          default_tax_rate: number | null;
          discount: Json | null;
          notes: string | null;
          payment_instructions: string | null;
          stripe_payment_link: string | null;
          client_snapshot: Json | null;
          profile_snapshot: Json | null;
          status: 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['invoices']['Row'], 'id' | 'workspace_id' | 'created_at' | 'updated_at'>>;
      };
      invoice_line_items: {
        Row: {
          id: string;
          invoice_id: string;
          position: number;
          description: string;
          quantity: number;
          unit_price: number;
          tax_rate: number | null;
        };
        Insert: Omit<Database['public']['Tables']['invoice_line_items']['Row'], 'id'> & {
          id?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['invoice_line_items']['Row'], 'id' | 'invoice_id'>>;
      };
      invoice_payments: {
        Row: {
          id: string;
          workspace_id: string;
          invoice_id: string;
          payment_date: string;
          amount: number;
          method: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoice_payments']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['invoice_payments']['Row'], 'id' | 'workspace_id' | 'invoice_id' | 'created_at'>>;
      };
      workspace_settings: {
        Row: {
          workspace_id: string;
          key: string;
          value: Json | null;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['workspace_settings']['Row'], 'updated_at'> & {
          updated_at?: string;
        };
        Update: Partial<Omit<Database['public']['Tables']['workspace_settings']['Row'], 'workspace_id' | 'key'>>;
      };
      invoice_events: {
        Row: {
          id: string;
          workspace_id: string;
          invoice_id: string;
          type: string;
          payload: Json | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['invoice_events']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_invoice_draft: {
        Args: { p_profile_id: string };
        Returns: string;
      };
      mark_invoice_sent: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      void_invoice: {
        Args: { p_invoice_id: string };
        Returns: undefined;
      };
      replace_invoice_line_items: {
        Args: { p_invoice_id: string; p_items: Json };
        Returns: undefined;
      };
      format_invoice_number: {
        Args: { p_format: string; p_counter: number; p_when?: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
