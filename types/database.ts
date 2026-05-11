/**
 * Types TypeScript générés depuis le schéma Supabase.
 * Régénérer avec : npx supabase gen types typescript --project-id bzsmhavrvurlmkfhbzyh
 * Ou via le MCP Supabase : mcp__claude_ai_Supabase__generate_typescript_types
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          adresse_ligne1: string | null;
          adresse_ligne2: string | null;
          code_postal: string | null;
          created_at: string;
          email: string | null;
          id: string;
          nom: string;
          notes: string | null;
          pays: string | null;
          raison_sociale: string | null;
          siret: string | null;
          telephone: string | null;
          type: string;
          updated_at: string;
          user_id: string;
          ville: string | null;
        };
        Insert: {
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          code_postal?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          nom: string;
          notes?: string | null;
          pays?: string | null;
          raison_sociale?: string | null;
          siret?: string | null;
          telephone?: string | null;
          type?: string;
          updated_at?: string;
          user_id: string;
          ville?: string | null;
        };
        Update: {
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          code_postal?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          nom?: string;
          notes?: string | null;
          pays?: string | null;
          raison_sociale?: string | null;
          siret?: string | null;
          telephone?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
          ville?: string | null;
        };
        Relationships: [];
      };
      contrats_maintenance: {
        Row: {
          client_id: string;
          created_at: string;
          date_debut: string;
          date_fin: string | null;
          equipement: string | null;
          equipement_num_serie: string | null;
          frequence: string;
          id: string;
          intitule: string | null;
          notes: string | null;
          prix_annuel_ht: number;
          prochaine_visite: string | null;
          statut: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          date_debut: string;
          date_fin?: string | null;
          equipement?: string | null;
          equipement_num_serie?: string | null;
          frequence?: string;
          id?: string;
          intitule?: string | null;
          notes?: string | null;
          prix_annuel_ht: number;
          prochaine_visite?: string | null;
          statut?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          date_debut?: string;
          date_fin?: string | null;
          equipement?: string | null;
          equipement_num_serie?: string | null;
          frequence?: string;
          id?: string;
          intitule?: string | null;
          notes?: string | null;
          prix_annuel_ht?: number;
          prochaine_visite?: string | null;
          statut?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contrats_maintenance_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      devis: {
        Row: {
          aides_financieres: Json;
          client_id: string;
          conditions: string | null;
          created_at: string;
          date_debut_travaux: string | null;
          date_emission: string;
          date_signature: string | null;
          date_validite: string;
          duree_estimee_jours: number | null;
          email_envoye_le: string | null;
          equipement_info: Json;
          facture_id: string | null;
          id: string;
          notes: string | null;
          numero: string;
          pdf_url: string | null;
          performances_energetiques: Json;
          signature_client_url: string | null;
          statut: string;
          total_ht: number;
          type_activite: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          aides_financieres?: Json;
          client_id: string;
          conditions?: string | null;
          created_at?: string;
          date_debut_travaux?: string | null;
          date_emission?: string;
          date_signature?: string | null;
          date_validite?: string;
          duree_estimee_jours?: number | null;
          email_envoye_le?: string | null;
          equipement_info?: Json;
          facture_id?: string | null;
          id?: string;
          notes?: string | null;
          numero: string;
          pdf_url?: string | null;
          performances_energetiques?: Json;
          signature_client_url?: string | null;
          statut?: string;
          total_ht?: number;
          type_activite?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          aides_financieres?: Json;
          client_id?: string;
          conditions?: string | null;
          created_at?: string;
          date_debut_travaux?: string | null;
          date_emission?: string;
          date_signature?: string | null;
          date_validite?: string;
          duree_estimee_jours?: number | null;
          email_envoye_le?: string | null;
          equipement_info?: Json;
          facture_id?: string | null;
          id?: string;
          notes?: string | null;
          numero?: string;
          pdf_url?: string | null;
          performances_energetiques?: Json;
          signature_client_url?: string | null;
          statut?: string;
          total_ht?: number;
          type_activite?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "devis_facture_id_fkey";
            columns: ["facture_id"];
            isOneToOne: false;
            referencedRelation: "factures";
            referencedColumns: ["id"];
          },
        ];
      };
      devis_lignes: {
        Row: {
          created_at: string;
          designation: string;
          devis_id: string;
          id: string;
          ordre: number;
          prix_unitaire_ht: number;
          quantite: number;
          total_ht: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          designation: string;
          devis_id: string;
          id?: string;
          ordre?: number;
          prix_unitaire_ht: number;
          quantite?: number;
          total_ht: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          designation?: string;
          devis_id?: string;
          id?: string;
          ordre?: number;
          prix_unitaire_ht?: number;
          quantite?: number;
          total_ht?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "devis_lignes_devis_id_fkey";
            columns: ["devis_id"];
            isOneToOne: false;
            referencedRelation: "devis";
            referencedColumns: ["id"];
          },
        ];
      };
      factures: {
        Row: {
          aides_financieres: Json;
          client_id: string;
          conditions_paiement: string | null;
          created_at: string;
          date_echeance: string;
          date_emission: string;
          date_prestation: string | null;
          date_prestation_fin: string | null;
          email_envoye_le: string | null;
          equipement_info: Json;
          id: string;
          notes: string | null;
          numero: string;
          pdf_url: string | null;
          statut: string;
          total_ht: number;
          type_activite: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          aides_financieres?: Json;
          client_id: string;
          conditions_paiement?: string | null;
          created_at?: string;
          date_echeance: string;
          date_emission?: string;
          date_prestation?: string | null;
          date_prestation_fin?: string | null;
          email_envoye_le?: string | null;
          equipement_info?: Json;
          id?: string;
          notes?: string | null;
          numero: string;
          pdf_url?: string | null;
          statut?: string;
          total_ht?: number;
          type_activite?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          aides_financieres?: Json;
          client_id?: string;
          conditions_paiement?: string | null;
          created_at?: string;
          date_echeance?: string;
          date_emission?: string;
          date_prestation?: string | null;
          date_prestation_fin?: string | null;
          email_envoye_le?: string | null;
          equipement_info?: Json;
          id?: string;
          notes?: string | null;
          numero?: string;
          pdf_url?: string | null;
          statut?: string;
          total_ht?: number;
          type_activite?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "factures_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
        ];
      };
      factures_lignes: {
        Row: {
          created_at: string;
          designation: string;
          facture_id: string;
          id: string;
          ordre: number;
          prix_unitaire_ht: number;
          quantite: number;
          total_ht: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          designation: string;
          facture_id: string;
          id?: string;
          ordre?: number;
          prix_unitaire_ht: number;
          quantite?: number;
          total_ht: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          designation?: string;
          facture_id?: string;
          id?: string;
          ordre?: number;
          prix_unitaire_ht?: number;
          quantite?: number;
          total_ht?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "factures_lignes_facture_id_fkey";
            columns: ["facture_id"];
            isOneToOne: false;
            referencedRelation: "factures";
            referencedColumns: ["id"];
          },
        ];
      };
      interventions: {
        Row: {
          client_id: string;
          created_at: string;
          date_intervention: string;
          date_fin: string | null;
          description: string | null;
          duree_minutes: number | null;
          equipement_marque: string | null;
          equipement_modele: string | null;
          equipement_num_serie: string | null;
          facture_id: string | null;
          fluide_frigo_kg_ajoute: number | null;
          fluide_frigo_kg_recupere: number | null;
          fluide_frigo_type: string | null;
          id: string;
          notes: string | null;
          type: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          created_at?: string;
          date_intervention: string;
          date_fin?: string | null;
          description?: string | null;
          duree_minutes?: number | null;
          equipement_marque?: string | null;
          equipement_modele?: string | null;
          equipement_num_serie?: string | null;
          facture_id?: string | null;
          fluide_frigo_kg_ajoute?: number | null;
          fluide_frigo_kg_recupere?: number | null;
          fluide_frigo_type?: string | null;
          id?: string;
          notes?: string | null;
          type?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          created_at?: string;
          date_intervention?: string;
          date_fin?: string | null;
          description?: string | null;
          duree_minutes?: number | null;
          equipement_marque?: string | null;
          equipement_modele?: string | null;
          equipement_num_serie?: string | null;
          facture_id?: string | null;
          fluide_frigo_kg_ajoute?: number | null;
          fluide_frigo_kg_recupere?: number | null;
          fluide_frigo_type?: string | null;
          id?: string;
          notes?: string | null;
          type?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interventions_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interventions_facture_id_fkey";
            columns: ["facture_id"];
            isOneToOne: false;
            referencedRelation: "factures";
            referencedColumns: ["id"];
          },
        ];
      };
      numerotation: {
        Row: {
          annee: number;
          dernier_numero: number;
          type_document: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          annee: number;
          dernier_numero?: number;
          type_document: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          annee?: number;
          dernier_numero?: number;
          type_document?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      paiements: {
        Row: {
          created_at: string;
          date_paiement: string;
          facture_id: string;
          id: string;
          mode: string;
          montant: number;
          notes: string | null;
          reference: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date_paiement: string;
          facture_id: string;
          id?: string;
          mode?: string;
          montant: number;
          notes?: string | null;
          reference?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date_paiement?: string;
          facture_id?: string;
          id?: string;
          mode?: string;
          montant?: number;
          notes?: string | null;
          reference?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paiements_facture_id_fkey";
            columns: ["facture_id"];
            isOneToOne: false;
            referencedRelation: "factures";
            referencedColumns: ["id"];
          },
        ];
      };
      produits_services: {
        Row: {
          actif: boolean;
          categorie: string;
          created_at: string;
          description: string | null;
          designation: string;
          id: string;
          prix_ht: number;
          tva_taux_suggere: number | null;
          unite: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          actif?: boolean;
          categorie?: string;
          created_at?: string;
          description?: string | null;
          designation: string;
          id?: string;
          prix_ht: number;
          tva_taux_suggere?: number | null;
          unite?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          actif?: boolean;
          categorie?: string;
          created_at?: string;
          description?: string | null;
          designation?: string;
          id?: string;
          prix_ht?: number;
          tva_taux_suggere?: number | null;
          unite?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profil_entreprise: {
        Row: {
          adresse_ligne1: string | null;
          adresse_ligne2: string | null;
          assureur_decennale: string | null;
          banque_nom: string | null;
          bic: string | null;
          calendar_token: string | null;
          code_ape: string | null;
          code_postal: string | null;
          conditions_paiement_default: string | null;
          created_at: string;
          email_pro: string | null;
          escompte_text: string | null;
          iban: string | null;
          id: string;
          logo_url: string | null;
          mediateur_adresse: string | null;
          mediateur_nom: string | null;
          mediateur_site_web: string | null;
          nom: string | null;
          nom_commercial: string | null;
          num_assurance_decennale: string | null;
          num_attestation_fluides_frigo: string | null;
          num_rge_qualipac: string | null;
          num_rm: string | null;
          pays: string | null;
          penalites_retard_text: string | null;
          prenom: string | null;
          siren: string | null;
          siret: string | null;
          site_web: string | null;
          telephone: string | null;
          updated_at: string;
          user_id: string;
          ville: string | null;
          zone_couverture_decennale: string | null;
        };
        Insert: {
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          assureur_decennale?: string | null;
          banque_nom?: string | null;
          bic?: string | null;
          calendar_token?: string | null;
          code_ape?: string | null;
          code_postal?: string | null;
          conditions_paiement_default?: string | null;
          created_at?: string;
          email_pro?: string | null;
          escompte_text?: string | null;
          iban?: string | null;
          id?: string;
          logo_url?: string | null;
          mediateur_adresse?: string | null;
          mediateur_nom?: string | null;
          mediateur_site_web?: string | null;
          nom?: string | null;
          nom_commercial?: string | null;
          num_assurance_decennale?: string | null;
          num_attestation_fluides_frigo?: string | null;
          num_rge_qualipac?: string | null;
          num_rm?: string | null;
          pays?: string | null;
          penalites_retard_text?: string | null;
          prenom?: string | null;
          siren?: string | null;
          siret?: string | null;
          site_web?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id: string;
          ville?: string | null;
          zone_couverture_decennale?: string | null;
        };
        Update: {
          adresse_ligne1?: string | null;
          adresse_ligne2?: string | null;
          assureur_decennale?: string | null;
          banque_nom?: string | null;
          bic?: string | null;
          calendar_token?: string | null;
          code_ape?: string | null;
          code_postal?: string | null;
          conditions_paiement_default?: string | null;
          created_at?: string;
          email_pro?: string | null;
          escompte_text?: string | null;
          iban?: string | null;
          id?: string;
          logo_url?: string | null;
          mediateur_adresse?: string | null;
          mediateur_nom?: string | null;
          mediateur_site_web?: string | null;
          nom?: string | null;
          nom_commercial?: string | null;
          num_assurance_decennale?: string | null;
          num_attestation_fluides_frigo?: string | null;
          num_rge_qualipac?: string | null;
          num_rm?: string | null;
          pays?: string | null;
          penalites_retard_text?: string | null;
          prenom?: string | null;
          siren?: string | null;
          siret?: string | null;
          site_web?: string | null;
          telephone?: string | null;
          updated_at?: string;
          user_id?: string;
          ville?: string | null;
          zone_couverture_decennale?: string | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      next_document_number: { Args: { p_type: string }; Returns: string };
      ensure_calendar_token: {
        Args: { p_force?: boolean };
        Returns: string;
      };
      calendar_events_for_token: {
        Args: { p_token: string };
        Returns: Array<{
          kind: string;
          ev_id: string;
          date_start: string;
          date_end: string;
          title: string;
          client_nom: string | null;
          statut: string | null;
          numero: string | null;
          type_activite: string | null;
          facture_emise: boolean | null;
        }>;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
