"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { enregistrerFicheGazAction } from "@/lib/actions/fiches-gaz";
import { appelerAction } from "@/lib/appel-action";
import { NATURES_INTERVENTION, periodiciteLabel, type NatureIntervention } from "@/lib/cerfa";
import {
  manipulationsDepuisJson,
  NATURES_COURTES,
  NATURES_INJECTION,
  NATURES_RECUPERATION,
  OBJETS_BON,
  totauxManipulations,
  TYPES_EQUIPEMENT,
  type FicheGazInput,
  type Manipulation,
  type NatureManipulation,
} from "@/lib/fiches-gaz";
import { equivalentCo2Tonnes, FLUIDES_CONNUS, formatEquivalentCo2 } from "@/lib/fluides";
import { ClientPicker } from "@/components/clients/client-picker";
import { LirePlaqueButton } from "@/components/interventions/lire-plaque-button";
import { MobileActionBar } from "@/components/mobile-action-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/types/database";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type Intervention = Database["public"]["Tables"]["interventions"]["Row"];

/** Saisie telle qu'elle vit dans le formulaire (chiffres en texte). */
type Etat = {
  client_id: string;
  date_intervention: string;
  natures_cerfa: NatureIntervention[];
  equipement_type: "climatisation" | "pompe_a_chaleur" | null;
  equipement_marque: string;
  equipement_repere: string;
  equipement_modele: string;
  equipement_num_serie: string;
  fluide_frigo_type: string;
  fluide_charge_totale_kg: string;
  manipulations: Array<{ type: Manipulation["type"]; nature: NatureManipulation; kg: string }>;
  etancheite_detecteur: string;
  etancheite_detecteur_controle_le: string;
  detection_permanente: boolean;
  etancheite_fuite: boolean | null;
  etancheite_fuite_localisation: string;
  fuite_reparation: "realisee" | "a_faire" | null;
  fluide_observations: string;
  bon_devis_numero: string;
  bon_objet: string;
  bon_reserves: "sans" | "avec" | null;
  bon_reserves_texte: string;
};

const AUTRE_FLUIDE = "__autre__";

function etatDepuisFiche(fiche: Intervention | null, defauts: { date: string; clientId?: string }): Etat {
  const kg = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    client_id: fiche?.client_id ?? defauts.clientId ?? "",
    date_intervention: fiche?.date_intervention ?? defauts.date,
    natures_cerfa: (fiche?.natures_cerfa ?? []).filter((n): n is NatureIntervention => n in NATURES_INTERVENTION),
    equipement_type: fiche?.equipement_type === "climatisation" || fiche?.equipement_type === "pompe_a_chaleur" ? fiche.equipement_type : null,
    equipement_marque: fiche?.equipement_marque ?? "",
    equipement_repere: fiche?.equipement_repere ?? "",
    equipement_modele: fiche?.equipement_modele ?? "",
    equipement_num_serie: fiche?.equipement_num_serie ?? "",
    fluide_frigo_type: fiche?.fluide_frigo_type ?? "",
    fluide_charge_totale_kg: kg(fiche?.fluide_charge_totale_kg !== null && fiche?.fluide_charge_totale_kg !== undefined ? Number(fiche.fluide_charge_totale_kg) : null),
    manipulations: manipulationsDepuisJson(fiche?.fluide_manipulations).map((m) => ({ ...m, kg: String(m.kg) })),
    etancheite_detecteur: fiche?.etancheite_detecteur ?? "",
    etancheite_detecteur_controle_le: fiche?.etancheite_detecteur_controle_le ?? "",
    detection_permanente: fiche?.detection_permanente ?? false,
    etancheite_fuite: fiche?.etancheite_fuite ?? null,
    etancheite_fuite_localisation: fiche?.etancheite_fuite_localisation ?? "",
    fuite_reparation: fiche?.fuite_reparation === "realisee" || fiche?.fuite_reparation === "a_faire" ? fiche.fuite_reparation : null,
    fluide_observations: fiche?.fluide_observations ?? "",
    bon_devis_numero: fiche?.bon_devis_numero ?? "",
    bon_objet: fiche?.bon_objet ?? "",
    bon_reserves: fiche?.bon_reserves === "sans" || fiche?.bon_reserves === "avec" ? fiche.bon_reserves : null,
    bon_reserves_texte: fiche?.bon_reserves_texte ?? "",
  };
}

function versSaisie(e: Etat): FicheGazInput {
  return {
    client_id: e.client_id,
    date_intervention: e.date_intervention,
    natures_cerfa: e.natures_cerfa,
    equipement_type: e.equipement_type,
    equipement_marque: e.equipement_marque,
    equipement_repere: e.equipement_repere,
    equipement_modele: e.equipement_modele,
    equipement_num_serie: e.equipement_num_serie,
    fluide_frigo_type: e.fluide_frigo_type,
    fluide_charge_totale_kg: e.fluide_charge_totale_kg,
    fluide_manipulations: e.manipulations.filter((m) => m.kg.trim() !== "").map((m) => ({ type: m.type, nature: m.nature, kg: m.kg })),
    etancheite_detecteur: e.etancheite_detecteur,
    etancheite_detecteur_controle_le: e.etancheite_detecteur_controle_le,
    detection_permanente: e.detection_permanente,
    etancheite_fuite: e.etancheite_fuite,
    etancheite_fuite_localisation: e.etancheite_fuite_localisation,
    fuite_reparation: e.fuite_reparation,
    fluide_observations: e.fluide_observations,
    bon_devis_numero: e.bon_devis_numero,
    bon_objet: e.bon_objet,
    bon_reserves: e.bon_reserves,
    bon_reserves_texte: e.bon_reserves_texte,
  };
}

function Puce({ actif, onClick, children, ton = "neutre" }: { actif: boolean; onClick: () => void; children: React.ReactNode; ton?: "neutre" | "alerte" }) {
  const actifCls = ton === "alerte" ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100" : "border-primary bg-primary/10 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${actif ? actifCls : "border-border bg-background text-foreground hover:bg-muted/60"}`}
    >
      {actif && <Check className="size-3.5" />}
      {children}
    </button>
  );
}

function Section({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{titre}</CardTitle>
        {aide && <CardDescription>{aide}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/**
 * Fiche gaz (mise en service, entretien, contrôle…) : une page, des
 * puces, tout ce qu'il faut pour le CERFA 15497 et le bon de réception.
 * La fiche existante s'enregistre toute seule (1,5 s après la dernière
 * frappe) ; une nouvelle fiche se crée au premier « Enregistrer » dès
 * que le client et la date sont connus.
 */
export function FicheGazForm({
  clients,
  fiche,
  dateParDefaut,
  clientIdParDefaut,
  detecteurs,
}: {
  clients: Client[];
  fiche: Intervention | null;
  dateParDefaut: string;
  clientIdParDefaut?: string;
  detecteurs: Array<{ nom: string; controle_le: string | null }>;
}) {
  const router = useRouter();
  const [etat, setEtat] = useState<Etat>(() => etatDepuisFiche(fiche, { date: dateParDefaut, clientId: clientIdParDefaut }));
  const [erreurClient, setErreurClient] = useState<string | undefined>();
  const [enregistrement, setEnregistrement] = useState<"inactif" | "en_cours" | "fait" | "erreur">("inactif");
  const [creation, setCreation] = useState(false);
  const modifie = useRef(false);
  const derniereSauvegarde = useRef<string>(JSON.stringify(versSaisie(etat)));
  const fluideAutre = etat.fluide_frigo_type !== "" && !FLUIDES_CONNUS.includes(etat.fluide_frigo_type);
  const [modeAutreFluide, setModeAutreFluide] = useState(fluideAutre);

  const maj = useCallback((patch: Partial<Etat>) => {
    modifie.current = true;
    setEtat((e) => ({ ...e, ...patch }));
  }, []);

  const charge = etat.fluide_charge_totale_kg.trim() === "" ? null : Number(etat.fluide_charge_totale_kg.replace(",", "."));
  const chargeValide = charge !== null && Number.isFinite(charge) ? charge : null;
  const teq = equivalentCo2Tonnes(etat.fluide_frigo_type, chargeValide);
  const totaux = useMemo(
    () => totauxManipulations(etat.manipulations.filter((m) => m.kg.trim() !== "").map((m) => ({ type: m.type, nature: m.nature, kg: Number(m.kg.replace(",", ".")) || 0 }))),
    [etat.manipulations],
  );
  const controleRenseigne = etat.etancheite_detecteur.trim() !== "" || etat.natures_cerfa.includes("controle_periodique") || etat.natures_cerfa.includes("controle_non_periodique");

  const enregistrer = useCallback(
    async (silencieux: boolean) => {
      if (!etat.client_id) {
        setErreurClient("Choisissez le client.");
        if (!silencieux) toast.error("Choisissez le client avant d'enregistrer.");
        return;
      }
      setErreurClient(undefined);
      const saisie = versSaisie(etat);
      const cle = JSON.stringify(saisie);
      if (fiche && cle === derniereSauvegarde.current) {
        setEnregistrement("fait");
        return;
      }
      setEnregistrement("en_cours");
      if (!fiche) setCreation(true);
      const res = await appelerAction(() => enregistrerFicheGazAction(fiche?.id ?? null, saisie));
      if (!res.ok) {
        setEnregistrement("erreur");
        setCreation(false);
        // En automatique, une saisie incomplète (date effacée…) ne doit
        // pas faire surgir une alerte à chaque pause : le statut suffit.
        if (!silencieux) toast.error("Enregistrement impossible", { description: res.error });
        return;
      }
      derniereSauvegarde.current = cle;
      setEnregistrement("fait");
      if (!fiche) {
        toast.success(`Fiche n° ${res.data.fiche_numero ?? ""} créée`, { description: "Ajoutez maintenant les photos, les signatures et générez les documents." });
        router.replace(`/fiches-gaz/${res.data.id}`);
        return;
      }
      if (!silencieux) toast.success("Fiche enregistrée");
      router.refresh();
    },
    [etat, fiche, router],
  );

  // Enregistrement automatique d'une fiche existante.
  useEffect(() => {
    if (!fiche || !modifie.current) return;
    const t = setTimeout(() => void enregistrer(true), 1500);
    return () => clearTimeout(t);
  }, [etat, fiche, enregistrer]);

  function toggleNature(n: NatureIntervention) {
    maj({ natures_cerfa: etat.natures_cerfa.includes(n) ? etat.natures_cerfa.filter((x) => x !== n) : [...etat.natures_cerfa, n] });
  }
  function majManipulation(i: number, patch: Partial<Etat["manipulations"][number]>) {
    const liste = etat.manipulations.map((m, j) => (j === i ? { ...m, ...patch } : m));
    // Nature cohérente avec le type.
    const m = liste[i];
    if (patch.type && m) {
      m.nature = patch.type === "injection" ? ("vierge" as NatureManipulation) : ("traitement" as NatureManipulation);
    }
    maj({ manipulations: liste });
  }

  const statut =
    enregistrement === "en_cours" ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Enregistrement…</span>
    ) : enregistrement === "fait" ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Check className="size-3 text-primary" /> Enregistré</span>
    ) : enregistrement === "erreur" ? (
      <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" /> Non enregistré</span>
    ) : null;

  return (
    <div className="space-y-4">
      <Section titre="Client et intervention">
        <div className="space-y-1.5">
          <Label htmlFor="client_id">Client *</Label>
          <ClientPicker clients={clients} value={etat.client_id} onChange={(id) => maj({ client_id: id })} error={erreurClient} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fiche_numero">N° de fiche</Label>
            <Input id="fiche_numero" value={fiche?.fiche_numero ?? ""} readOnly placeholder="Attribué à la création" className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date_intervention">Date *</Label>
            <Input id="date_intervention" type="date" value={etat.date_intervention} onChange={(e) => maj({ date_intervention: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section titre="Type d'intervention" aide="Plusieurs choix possibles — repris dans le cadre 4 du CERFA.">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(NATURES_COURTES) as NatureIntervention[]).map((n) => (
            <Puce key={n} actif={etat.natures_cerfa.includes(n)} onClick={() => toggleNature(n)}>
              {NATURES_COURTES[n]}
            </Puce>
          ))}
        </div>
      </Section>

      <Section titre="Équipement">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(TYPES_EQUIPEMENT) as Array<[Etat["equipement_type"] & string, string]>).map(([k, v]) => (
            <Puce key={k} actif={etat.equipement_type === k} onClick={() => maj({ equipement_type: etat.equipement_type === k ? null : k })}>
              {v}
            </Puce>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="equipement_marque">Marque</Label>
            <Input id="equipement_marque" value={etat.equipement_marque} onChange={(e) => maj({ equipement_marque: e.target.value })} placeholder="Daikin, Mitsubishi, Atlantic…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipement_repere">Repère</Label>
            <Input id="equipement_repere" value={etat.equipement_repere} onChange={(e) => maj({ equipement_repere: e.target.value })} placeholder="Ex : UE1, PAC garage, salon" />
          </div>
        </div>
        <LirePlaqueButton
          onAppliquer={(c) =>
            maj({
              equipement_marque: c.marque || etat.equipement_marque,
              equipement_modele: c.modele || etat.equipement_modele,
              equipement_num_serie: c.numSerie || etat.equipement_num_serie,
              fluide_frigo_type: c.fluide || etat.fluide_frigo_type,
              fluide_charge_totale_kg: c.chargeKg || etat.fluide_charge_totale_kg,
            })
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="equipement_modele">Unité extérieure — modèle</Label>
            <Input id="equipement_modele" value={etat.equipement_modele} onChange={(e) => maj({ equipement_modele: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipement_num_serie">Unité extérieure — n° de série</Label>
            <Input id="equipement_num_serie" value={etat.equipement_num_serie} onChange={(e) => maj({ equipement_num_serie: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section titre="Fluide et charge">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="fluide">Fluide</Label>
            <Select
              value={modeAutreFluide ? AUTRE_FLUIDE : etat.fluide_frigo_type || undefined}
              onValueChange={(v) => {
                if (v === AUTRE_FLUIDE) {
                  setModeAutreFluide(true);
                  maj({ fluide_frigo_type: "" });
                } else {
                  setModeAutreFluide(false);
                  maj({ fluide_frigo_type: v });
                }
              }}
            >
              <SelectTrigger id="fluide">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {FLUIDES_CONNUS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
                <SelectItem value={AUTRE_FLUIDE}>Autre…</SelectItem>
              </SelectContent>
            </Select>
            {modeAutreFluide && (
              <Input aria-label="Autre fluide" value={etat.fluide_frigo_type} onChange={(e) => maj({ fluide_frigo_type: e.target.value.toUpperCase() })} placeholder="Ex : R454B" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="charge">Charge totale (kg)</Label>
            <Input id="charge" inputMode="decimal" value={etat.fluide_charge_totale_kg} onChange={(e) => maj({ fluide_charge_totale_kg: e.target.value })} placeholder="0,68" />
          </div>
          <div className="space-y-1.5">
            <Label>Équivalent CO₂</Label>
            <p className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">{teq !== null ? formatEquivalentCo2(teq) : "—"}</p>
          </div>
        </div>
      </Section>

      <Section titre="Manipulations de fluide" aide={`Ajouté ${totaux.ajoute.toLocaleString("fr-FR")} kg · récupéré ${totaux.recupere.toLocaleString("fr-FR")} kg — cadre 11 du CERFA.`}>
        {etat.manipulations.length > 0 && (
          <ul className="space-y-2">
            {etat.manipulations.map((m, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_5.5rem_2.5rem] items-end gap-2">
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Opération</Label>}
                  <Select value={m.type} onValueChange={(v) => majManipulation(i, { type: v as Manipulation["type"] })}>
                    <SelectTrigger aria-label="Opération">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="injection">Ajout (charge)</SelectItem>
                      <SelectItem value="recuperation">Récupération</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">Nature</Label>}
                  <Select value={m.nature} onValueChange={(v) => majManipulation(i, { nature: v as NatureManipulation })}>
                    <SelectTrigger aria-label="Nature du fluide">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(m.type === "injection" ? NATURES_INJECTION : NATURES_RECUPERATION).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  {i === 0 && <Label className="text-xs">kg</Label>}
                  <Input inputMode="decimal" aria-label="Quantité (kg)" value={m.kg} onChange={(e) => majManipulation(i, { kg: e.target.value })} placeholder="0,5" />
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => maj({ manipulations: etat.manipulations.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="outline" onClick={() => maj({ manipulations: [...etat.manipulations, { type: "injection", nature: "vierge", kg: "" }] })}>
          <Plus className="size-4" />
          Ajouter une manipulation
        </Button>
      </Section>

      <Section titre="Contrôle d'étanchéité">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="detecteur">Détecteur</Label>
            <Input
              id="detecteur"
              list="detecteurs-connus"
              value={etat.etancheite_detecteur}
              onChange={(e) => {
                const connu = detecteurs.find((d) => d.nom === e.target.value);
                maj({ etancheite_detecteur: e.target.value, ...(connu?.controle_le && !etat.etancheite_detecteur_controle_le ? { etancheite_detecteur_controle_le: connu.controle_le } : {}) });
              }}
              placeholder="Marque, modèle, n° de série"
            />
            <datalist id="detecteurs-connus">
              {detecteurs.map((d) => (
                <option key={d.nom} value={d.nom} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="detecteur_controle">Détecteur contrôlé / étalonné le</Label>
            <Input id="detecteur_controle" type="date" value={etat.etancheite_detecteur_controle_le} onChange={(e) => maj({ etancheite_detecteur_controle_le: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Système permanent de détection des fuites</Label>
          <div className="flex gap-2">
            <Puce actif={!etat.detection_permanente} onClick={() => maj({ detection_permanente: false })}>Non</Puce>
            <Puce actif={etat.detection_permanente} onClick={() => maj({ detection_permanente: true })}>Oui</Puce>
          </div>
        </div>
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Périodicité réglementaire : </span>
          {periodiciteLabel(etat.fluide_frigo_type, chargeValide, etat.detection_permanente)}
        </p>
        <div className="space-y-1.5">
          <Label>Fuite</Label>
          <div className="flex flex-wrap gap-2">
            <Puce actif={etat.etancheite_fuite === false} onClick={() => maj({ etancheite_fuite: false, etancheite_fuite_localisation: "", fuite_reparation: null })}>Aucune</Puce>
            <Puce ton="alerte" actif={etat.etancheite_fuite === true} onClick={() => maj({ etancheite_fuite: true })}>Détectée</Puce>
          </div>
          {!controleRenseigne && etat.etancheite_fuite === null && (
            <p className="text-xs text-muted-foreground">Indiquez le détecteur ou cochez un contrôle d&apos;étanchéité pour que le contrôle figure sur le CERFA.</p>
          )}
        </div>
        {etat.etancheite_fuite === true && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fuite_loc">Localisation de la fuite</Label>
              <Input id="fuite_loc" value={etat.etancheite_fuite_localisation} onChange={(e) => maj({ etancheite_fuite_localisation: e.target.value })} placeholder="Ex : raccord flare UE, vanne de service" />
            </div>
            <div className="space-y-1.5">
              <Label>Réparation</Label>
              <div className="flex gap-2">
                <Puce actif={etat.fuite_reparation === "realisee"} onClick={() => maj({ fuite_reparation: "realisee" })}>Réalisée</Puce>
                <Puce actif={etat.fuite_reparation === "a_faire"} onClick={() => maj({ fuite_reparation: "a_faire" })}>À faire</Puce>
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section titre="Observations" aide="Reportées sur le CERFA (cadre 14).">
        <Textarea value={etat.fluide_observations} onChange={(e) => maj({ fluide_observations: e.target.value })} rows={3} placeholder="Ex : mise en service effectuée, pressions et températures conformes, client informé de l'entretien annuel." />
      </Section>

      <Section titre="Bon de réception" aide="Objet des travaux et réserves du client. Avec la signature en ligne, c'est le client qui indique ses réserves.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bon_devis">N° de devis</Label>
            <Input id="bon_devis" value={etat.bon_devis_numero} onChange={(e) => maj({ bon_devis_numero: e.target.value })} placeholder="D-2026-0012" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bon_objet">Objet des travaux</Label>
          <div className="flex flex-wrap gap-2">
            {OBJETS_BON.map((o) => (
              <Puce key={o} actif={etat.bon_objet === o} onClick={() => maj({ bon_objet: etat.bon_objet === o ? "" : o })}>
                {o}
              </Puce>
            ))}
          </div>
          <Input id="bon_objet" value={etat.bon_objet} onChange={(e) => maj({ bon_objet: e.target.value })} placeholder="Ou objet libre…" />
        </div>
        <div className="space-y-1.5">
          <Label>Réserves</Label>
          <div className="flex gap-2">
            <Puce actif={etat.bon_reserves === "sans"} onClick={() => maj({ bon_reserves: etat.bon_reserves === "sans" ? null : "sans", bon_reserves_texte: "" })}>Sans réserve</Puce>
            <Puce ton="alerte" actif={etat.bon_reserves === "avec"} onClick={() => maj({ bon_reserves: etat.bon_reserves === "avec" ? null : "avec" })}>Avec réserves</Puce>
          </div>
          {etat.bon_reserves === "avec" && (
            <Textarea value={etat.bon_reserves_texte} onChange={(e) => maj({ bon_reserves_texte: e.target.value })} rows={2} placeholder="Détail des réserves" />
          )}
        </div>
      </Section>

      <div className="flex items-center justify-between gap-3 max-md:hidden">
        <div>{statut}</div>
        <Button type="button" onClick={() => void enregistrer(false)} disabled={enregistrement === "en_cours" || creation}>
          {enregistrement === "en_cours" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {fiche ? "Enregistrer" : "Créer la fiche"}
        </Button>
      </div>
      <div className="md:hidden">{statut}</div>
      {!fiche && (
        <MobileActionBar>
          <Button type="button" size="lg" onClick={() => void enregistrer(false)} disabled={creation}>
            {creation ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Créer la fiche
          </Button>
        </MobileActionBar>
      )}
    </div>
  );
}
