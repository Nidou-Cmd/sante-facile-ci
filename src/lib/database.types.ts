// ============================================================
// Types de la base de données Supabase — écrits à la main pour
// les Modules 1 à 10. Régénérables ensuite avec la CLI Supabase :
//   npx supabase gen types typescript --project-id VOTRE_REF > src/lib/database.types.ts
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'patient' | 'medecin' | 'pharmacie' | 'assureur' | 'admin'
export type AppointmentStatus = 'en_attente' | 'confirme' | 'annule' | 'termine'
export type PrescriptionStatus = 'emise' | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee'
export type DeliveryStatus = 'preparation' | 'en_route' | 'livre'
export type PolicyStatus = 'actif' | 'suspendu'
export type CoverageStatus = 'en_attente' | 'approuvee_totale' | 'approuvee_partielle' | 'refusee'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: UserRole
          full_name: string
          email: string
          phone: string | null
          is_verified: boolean
          accepted_terms_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: UserRole
          full_name?: string
          email?: string
          phone?: string | null
          is_verified?: boolean
          accepted_terms_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: UserRole
          full_name?: string
          email?: string
          phone?: string | null
          is_verified?: boolean
          accepted_terms_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          id: string
          owner_profile_id: string | null
          name: string
          address_line: string
          commune: string
          city: string
          lat: number | null
          lng: number | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_profile_id?: string | null
          name: string
          address_line?: string
          commune?: string
          city?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_profile_id?: string | null
          name?: string
          address_line?: string
          commune?: string
          city?: string
          lat?: number | null
          lng?: number | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      patient_profiles: {
        Row: {
          id: string
          address_line: string
          commune: string
          city: string
          lat: number | null
          lng: number | null
          preferred_pharmacy_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          address_line?: string
          commune?: string
          city?: string
          lat?: number | null
          lng?: number | null
          preferred_pharmacy_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          address_line?: string
          commune?: string
          city?: string
          lat?: number | null
          lng?: number | null
          preferred_pharmacy_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      medecin_profiles: {
        Row: {
          id: string
          speciality: string
          is_available_now: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          speciality?: string
          is_available_now?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          speciality?: string
          is_available_now?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          medecin_id: string | null
          patient_name: string
          medecin_name: string
          scheduled_at: string | null
          duration_minutes: number
          reason: string
          is_emergency: boolean
          status: AppointmentStatus
          room_code: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          medecin_id?: string | null
          patient_name?: string
          medecin_name?: string
          scheduled_at?: string | null
          duration_minutes?: number
          reason?: string
          is_emergency?: boolean
          status?: AppointmentStatus
          room_code?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          medecin_id?: string | null
          patient_name?: string
          medecin_name?: string
          scheduled_at?: string | null
          duration_minutes?: number
          reason?: string
          is_emergency?: boolean
          status?: AppointmentStatus
          room_code?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          id: string
          appointment_id: string | null
          patient_id: string
          medecin_id: string
          pharmacy_id: string | null
          patient_name: string
          medecin_name: string
          pharmacy_name: string
          diagnosis: string
          status: PrescriptionStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          appointment_id?: string | null
          patient_id: string
          medecin_id: string
          pharmacy_id?: string | null
          patient_name?: string
          medecin_name?: string
          pharmacy_name?: string
          diagnosis?: string
          status?: PrescriptionStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          appointment_id?: string | null
          patient_id?: string
          medecin_id?: string
          pharmacy_id?: string | null
          patient_name?: string
          medecin_name?: string
          pharmacy_name?: string
          diagnosis?: string
          status?: PrescriptionStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          id: string
          prescription_id: string
          medication_name: string
          dosage: string
          frequency: string
          duration: string
          instructions: string
          created_at: string
        }
        Insert: {
          id?: string
          prescription_id: string
          medication_name: string
          dosage?: string
          frequency?: string
          duration?: string
          instructions?: string
          created_at?: string
        }
        Update: {
          id?: string
          prescription_id?: string
          medication_name?: string
          dosage?: string
          frequency?: string
          duration?: string
          instructions?: string
          created_at?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          id: string
          pharmacy_id: string
          medication_name: string
          quantity: number
          price_fcfa: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pharmacy_id: string
          medication_name: string
          quantity?: number
          price_fcfa?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pharmacy_id?: string
          medication_name?: string
          quantity?: number
          price_fcfa?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sante_deliveries: {
        Row: {
          id: string
          prescription_id: string
          pharmacy_id: string
          patient_id: string
          courier_name: string
          courier_phone: string
          status: DeliveryStatus
          started_at: string
          en_route_at: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prescription_id: string
          pharmacy_id: string
          patient_id: string
          courier_name?: string
          courier_phone?: string
          status?: DeliveryStatus
          started_at?: string
          en_route_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prescription_id?: string
          pharmacy_id?: string
          patient_id?: string
          courier_name?: string
          courier_phone?: string
          status?: DeliveryStatus
          started_at?: string
          en_route_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          id: string
          insurer_profile_id: string
          patient_id: string
          insurer_name: string
          patient_name: string
          policy_number: string
          coverage_percent: number
          status: PolicyStatus
          valid_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          insurer_profile_id: string
          patient_id: string
          insurer_name?: string
          patient_name?: string
          policy_number: string
          coverage_percent?: number
          status?: PolicyStatus
          valid_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          insurer_profile_id?: string
          patient_id?: string
          insurer_name?: string
          patient_name?: string
          policy_number?: string
          coverage_percent?: number
          status?: PolicyStatus
          valid_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          id: string
          prescription_id: string
          policy_id: string
          insurer_profile_id: string
          patient_id: string
          patient_name: string
          status: CoverageStatus
          covered_percent: number | null
          amount_fcfa: number | null
          notes: string
          decided_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          prescription_id: string
          policy_id: string
          insurer_profile_id: string
          patient_id: string
          patient_name?: string
          status?: CoverageStatus
          covered_percent?: number | null
          amount_fcfa?: number | null
          notes?: string
          decided_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          prescription_id?: string
          policy_id?: string
          insurer_profile_id?: string
          patient_id?: string
          patient_name?: string
          status?: CoverageStatus
          covered_percent?: number | null
          amount_fcfa?: number | null
          notes?: string
          decided_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          patient_id: string
          medecin_id: string
          patient_name: string
          medecin_name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          medecin_id: string
          patient_name?: string
          medecin_name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          medecin_id?: string
          patient_name?: string
          medecin_name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          content: string
          file_path: string | null
          file_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          content?: string
          file_path?: string | null
          file_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          content?: string
          file_path?: string | null
          file_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      sante_notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          link_path: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body?: string
          link_path?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          link_path?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      sante_settings: {
        Row: {
          key: string
          value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: UserRole
      }
      nearest_pharmacies: {
        Args: { p_lat: number; p_lng: number; p_limit?: number }
        Returns: {
          id: string
          name: string
          address_line: string
          commune: string
          city: string
          lat: number
          lng: number
          phone: string | null
          distance_km: number
        }[]
      }
      list_verified_doctors: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          full_name: string
          speciality: string
          is_available_now: boolean
        }[]
      }
      select_pharmacy_for_patient: {
        Args: { p_patient: string }
        Returns: { pharmacy_id: string; pharmacy_name: string }[]
      }
      find_patient_by_email: {
        Args: { p_email: string }
        Returns: { id: string; full_name: string }[]
      }
    }
    Enums: {
      user_role: UserRole
      appointment_status: AppointmentStatus
      prescription_status: PrescriptionStatus
      delivery_status: DeliveryStatus
      policy_status: PolicyStatus
      coverage_status: CoverageStatus
    }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Pharmacy = Database['public']['Tables']['pharmacies']['Row']
export type PatientProfile = Database['public']['Tables']['patient_profiles']['Row']
export type MedecinProfile = Database['public']['Tables']['medecin_profiles']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type Prescription = Database['public']['Tables']['prescriptions']['Row']
export type PrescriptionItem = Database['public']['Tables']['prescription_items']['Row']
export type StockItem = Database['public']['Tables']['stock_items']['Row']
export type Delivery = Database['public']['Tables']['sante_deliveries']['Row']
export type InsurancePolicy = Database['public']['Tables']['insurance_policies']['Row']
export type CoverageRequest = Database['public']['Tables']['coverage_requests']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type ChatMessage = Database['public']['Tables']['messages']['Row']
export type SanteNotification = Database['public']['Tables']['sante_notifications']['Row']
export type NearbyPharmacy = Database['public']['Functions']['nearest_pharmacies']['Returns'][number]
export type VerifiedDoctor = Database['public']['Functions']['list_verified_doctors']['Returns'][number]
