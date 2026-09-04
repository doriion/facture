import type { TemplateContrat } from "@/lib/contrats/types";

/**
 * TEXTE DU CONTRAT D'ENTRETIEN — VERSION 1 (2026).
 *
 * Repris à l'identique du modèle de référence
 * « Contrat_Entretien_Nathan_Geneve » (12 articles + annexe).
 *
 * RÈGLES DE CE FICHIER :
 * - Il est FIGÉ : un contrat signé porte template_version = 1 et doit
 *   pouvoir être régénéré à l'identique dans des années. Pour modifier
 *   le texte, créer template-v2.ts et changer la version par défaut
 *   (voir docs/contrats.md) — ne JAMAIS retoucher ce fichier autrement
 *   que pour une coquille sans portée juridique.
 * - Les valeurs variables sont des espaces réservés {commeCeci},
 *   remplies au rendu depuis le contrat et les snapshots (jamais de
 *   coordonnées en dur : le déménagement du prestataire ne doit pas
 *   toucher ce fichier).
 * - `visible` restreint un bloc ou un article :
 *   « particulier » / « professionnel » (qualité du client),
 *   « retractation » (particulier ET conclu à distance ou hors
 *   établissement), « sans-retractation » (le complément).
 * - TVA : mention « TVA non applicable, art. 293 B du CGI » — aucun
 *   calcul de TVA nulle part dans ce module.
 */
export const TEMPLATE_CONTRAT_V1: TemplateContrat = {
  version: 1,
  titre: "CONTRAT D'ENTRETIEN",
  sousTitre: "Installation de chauffage, climatisation et pompe à chaleur",
  preambule: "Il a été convenu ce qui suit.",
  articles: [
    {
      numero: 1,
      titre: "OBJET DU CONTRAT",
      blocs: [
        { kind: "h3", texte: "1.1 Définition" },
        {
          kind: "p",
          texte:
            "Par le présent contrat, le client confie au prestataire, qui l'accepte, l'entretien préventif et le contrôle périodique de l'installation décrite ci-dessous. Le prestataire intervient en qualité de professionnel qualifié au sens du décret n° 2020-912 du 28 juillet 2020 relatif à l'inspection et à l'entretien des chaudières, des systèmes de chauffage et des systèmes de climatisation.",
        },
        {
          kind: "p",
          texte:
            "Le prestataire est titulaire de l'attestation de capacité à la manipulation des fluides frigorigènes, catégorie I, n° {numAttestationFluides}, ainsi que des titres CAP et BP Plomberie et du Titre professionnel Froid et Climatisation.",
        },
        { kind: "h3", texte: "1.2 Installation couverte" },
        { kind: "table-equipements" },
        {
          kind: "p",
          texte:
            "Seuls les équipements listés ci-dessus sont couverts. Le contrat ne couvre ni le réseau de distribution en amont et en aval des équipements, ni les émetteurs (radiateurs, plancher chauffant), ni les installations électriques du logement, sauf mention expresse ajoutée au tableau.",
        },
        { kind: "h3", texte: "1.3 Modification de l'installation" },
        {
          kind: "p",
          texte:
            "Toute modification, adjonction ou suppression d'équipement fera l'objet d'un avenant écrit signé des deux parties, avec ajustement de la redevance le cas échéant.",
        },
      ],
    },
    {
      numero: 2,
      titre: "ENGAGEMENTS DU PRESTATAIRE",
      blocs: [
        { kind: "h3", texte: "2.1 Nature et fréquence de la visite" },
        {
          kind: "p",
          texte:
            "Le prestataire assure une (1) visite d'entretien par an sur les équipements désignés à l'article 1.2. La visite est programmée à une date convenue d'un commun accord, sur proposition du prestataire adressée au client au moins quinze (15) jours à l'avance par e-mail, SMS ou téléphone.",
        },
        {
          kind: "note",
          texte:
            "Rappel réglementaire : l'entretien d'un système thermodynamique d'une puissance nominale comprise entre 4 et 70 kW est obligatoire au moins une fois tous les deux ans (art. R. 224-44-3 du code de l'environnement). La périodicité annuelle retenue au présent contrat est plus favorable que l'obligation légale ; elle correspond aux préconisations de la plupart des constructeurs, qui conditionnent le maintien de leur garantie à un entretien annuel.",
        },
        { kind: "h3", texte: "2.2 Opérations réalisées" },
        {
          kind: "p",
          texte:
            "La visite d'entretien comprend exclusivement les opérations suivantes :",
        },
        {
          kind: "li",
          items: [
            "contrôle général de fonctionnement de l'unité extérieure, de la ou des unités intérieures et du compresseur (bruits, vibrations, cyclage) ;",
            "relevé des paramètres de fonctionnement : pressions, températures d'entrée et de sortie, intensités absorbées ;",
            "vérification des fixations, supports et liaisons frigorifiques apparentes ;",
            "contrôle d'étanchéité du circuit frigorifique lorsque la charge de l'équipement le rend obligatoire au regard de la réglementation en vigueur sur les gaz à effet de serre fluorés ;",
            "vérification des organes de régulation, sécurités et automatismes ;",
            "nettoyage ou remplacement des filtres des unités intérieures ;",
            "nettoyage et désinfection des batteries d'échange, dépoussiérage des unités intérieures et extérieures ;",
            "dépoussiérage du ou des coffrets électriques et resserrage des connexions ;",
            "contrôle de la pompe de relevage, de l'écoulement des condensats et nettoyage du bac à condensats ;",
            "pour les installations hydrauliques : contrôle de la pression du circuit, du vase d'expansion, du circulateur, de la soupape de sécurité et purge si nécessaire ;",
            "remplacement des petites pièces d'usure dont la valeur unitaire n'excède pas {plafondPieces} (joints, visserie, fusibles, filtres standard) ;",
            "nettoyage du poste de travail et évacuation des déchets d'intervention.",
          ],
        },
        {
          kind: "p",
          texte:
            "La redevance annuelle comprend le temps d'intervention et les frais de déplacement afférents à cette visite.",
        },
        { kind: "h3", texte: "2.3 Attestation et compte rendu" },
        {
          kind: "p",
          texte:
            "À l'issue de chaque visite, le prestataire remet au client une attestation d'entretien et un compte rendu détaillant les opérations effectuées, les relevés, les anomalies constatées et les préconisations. Ces documents sont remis dans un délai de quinze (15) jours suivant la visite. Le client les conserve et les tient à disposition en cas de contrôle.",
        },
        { kind: "h3", texte: "2.4 Ce que le contrat ne comprend pas" },
        {
          kind: "p",
          texte:
            "Sont exclus de la redevance et font l'objet d'une facturation séparée :",
        },
        {
          kind: "li",
          items: [
            "les dépannages et interventions consécutifs à une panne ;",
            "le remplacement des pièces détachées et des consommables (filtres spécifiques, télécommandes, pompes de condensats, pièces de carrosserie, cartes électroniques) ;",
            "les compléments et recharges de fluide frigorigène ;",
            "le désembouage, le détartrage et le traitement de l'eau des circuits hydrauliques ;",
            "les travaux de mise en conformité liés à l'évolution de la réglementation ;",
            "les interventions rendues nécessaires par une mauvaise utilisation, une modification effectuée par un tiers, un défaut d'alimentation électrique, le gel, la foudre ou tout événement extérieur.",
          ],
        },
      ],
    },
    {
      numero: 3,
      titre: "DÉPANNAGE ET REMISE EN ÉTAT",
      blocs: [
        { kind: "h3", texte: "3.1 Dépannage" },
        {
          kind: "p",
          texte:
            "Toute intervention hors visite d'entretien fait l'objet d'un devis préalable, accepté par le client avant exécution. Le devis détaille les pièces, la main-d'œuvre et le déplacement. Lorsque le dépannage peut être réalisé immédiatement lors de la visite d'entretien, il est exécuté après accord exprès du client, même verbal, et facturé sur la base de la fiche d'intervention remise sur place.",
        },
        { kind: "h3", texte: "3.2 Remise en état ou remplacement" },
        {
          kind: "p",
          texte:
            "Si l'état d'un équipement compromet sa sécurité, son rendement ou la bonne exécution de l'entretien, le prestataire en informe le client et lui soumet un devis. En cas de refus, l'équipement concerné est retiré du champ du contrat par avenant, sans que cela n'ouvre droit à réduction de la redevance en cours d'année.",
        },
        { kind: "h3", texte: "3.3 Garantie constructeur" },
        {
          kind: "p",
          texte:
            "Le présent contrat ne se substitue pas aux garanties légales et contractuelles attachées aux équipements. Lorsqu'une pièce est prise en charge par la garantie du constructeur, seuls la main-d'œuvre et le déplacement restent à la charge du client, sauf disposition contraire du contrat de garantie.",
        },
      ],
    },
    {
      numero: 4,
      titre: "ENGAGEMENTS DU CLIENT",
      blocs: [
        { kind: "p", texte: "Le client s'engage à :" },
        {
          kind: "li",
          items: [
            "désigner un interlocuteur unique et communiquer ses coordonnées au prestataire ;",
            "laisser au prestataire un accès libre et sécurisé aux équipements aux dates convenues, du lundi au vendredi de 8 h à 12 h et de 13 h à 17 h ;",
            "mettre à disposition la documentation technique, les notices et les précédents comptes rendus d'entretien ;",
            "fournir les énergies et fluides nécessaires au fonctionnement de l'installation et aux opérations d'entretien ;",
            "n'apporter aucune modification à l'installation et ne faire intervenir aucun tiers sur les équipements couverts sans en informer préalablement le prestataire ;",
            "signaler sans délai toute anomalie de fonctionnement et faire procéder aux réparations nécessaires au bon fonctionnement ultérieur du matériel ;",
            "prévenir le prestataire au moins quarante-huit (48) heures à l'avance en cas d'empêchement. À défaut, un déplacement infructueux pourra être facturé au tarif en vigueur.",
          ],
        },
      ],
    },
    {
      numero: 5,
      titre: "RESPONSABILITÉ",
      blocs: [
        {
          kind: "p",
          texte:
            "Le prestataire est tenu d'une obligation de moyens dans l'exécution des prestations d'entretien définies à l'article 2. Il répond des dommages directs causés par sa faute dans l'exécution du contrat, dans les limites de sa police de responsabilité civile professionnelle.",
        },
        {
          kind: "p",
          texte: "Sa responsabilité ne saurait être engagée au titre :",
        },
        {
          kind: "li",
          items: [
            "des pannes et de l'usure normale des équipements, ni de la vétusté de l'installation existante ;",
            "des conséquences d'une interruption de chauffage ou de climatisation, notamment la détérioration de biens, marchandises ou denrées ;",
            "des dommages résultant d'un défaut d'utilisation, d'une intervention de tiers, d'un défaut d'alimentation électrique ou hydraulique, du gel, d'un dégât des eaux, d'un incendie, d'un acte de malveillance ou d'un événement de force majeure ;",
            "des installations, réseaux ou équipements non désignés à l'article 1.2.",
          ],
        },
        {
          kind: "p",
          texte:
            "Le prestataire ne peut être tenu pour responsable d'une non-conformité préexistante à l'entrée en vigueur du contrat et signalée au client dans son compte rendu.",
        },
      ],
    },
    {
      numero: 6,
      titre: "PRIX, RÉVISION ET PAIEMENT",
      blocs: [
        { kind: "h3", texte: "6.1 Redevance annuelle" },
        { kind: "table-prix" },
        {
          kind: "p",
          texte:
            "TVA non applicable, article 293 B du code général des impôts. Le prestataire relève du régime de la franchise en base de TVA : les montants indiqués sont nets de taxe et aucune TVA ne peut être récupérée par le client.",
        },
        { kind: "h3", texte: "6.2 Révision annuelle" },
        {
          kind: "p",
          texte:
            "La redevance est révisée de plein droit à chaque date anniversaire du contrat selon la formule :",
        },
        { kind: "formule", texte: "P' = P × S' / S" },
        {
          kind: "p",
          texte:
            "où P est la redevance en vigueur, P' la redevance révisée, S l'indice du coût horaire du travail — tous salariés (ICHT-TS, version « industries mécaniques et électriques ») publié à la date de signature ou de la dernière révision, et S' le dernier indice publié à la date de révision. En cas de disparition de l'indice, l'indice de remplacement lui sera substitué de plein droit.",
        },
        { kind: "h3", texte: "6.3 Modalités de paiement" },
        {
          kind: "p",
          texte:
            "La redevance est due par année d'avance et facturée à l'échéance annuelle. Les factures sont payables à réception, par virement bancaire ou chèque.",
        },
        {
          kind: "p",
          texte:
            "Conformément aux articles L. 441-10 et D. 441-5 du code de commerce, tout retard de paiement d'un client professionnel entraîne de plein droit des pénalités calculées au taux d'intérêt de la Banque centrale européenne majoré de dix points, ainsi qu'une indemnité forfaitaire de recouvrement de 40 €. Pour un client consommateur, les sommes impayées produisent intérêt au taux légal après mise en demeure restée sans effet.",
        },
      ],
    },
    {
      numero: 7,
      titre: "DURÉE ET RECONDUCTION",
      blocs: [
        {
          kind: "p",
          texte:
            "Le contrat prend effet le {dateEffet} pour une durée initiale d'un (1) an.",
        },
        {
          kind: "p",
          texte:
            "Il se renouvelle ensuite par tacite reconduction, par périodes successives d'un (1) an, sauf dénonciation par l'une des parties adressée à l'autre par lettre recommandée avec accusé de réception au moins deux (2) mois avant l'échéance annuelle.",
        },
        {
          kind: "p",
          visible: "particulier",
          texte:
            "Client consommateur : conformément aux articles L. 215-1 et suivants du code de la consommation, le prestataire informe le client, par écrit et au plus tôt trois mois et au plus tard un mois avant l'échéance, de sa faculté de ne pas reconduire le contrat. À défaut d'une telle information, le client peut mettre fin au contrat gratuitement, à tout moment à compter de la date de reconduction, et les sommes versées après la date de reconduction lui sont remboursées.",
        },
      ],
    },
    {
      numero: 8,
      titre: "DROIT DE RÉTRACTATION",
      blocs: [
        {
          kind: "p",
          visible: "retractation",
          texte:
            "Lorsque le contrat est conclu hors établissement, notamment au domicile du client, ou à distance, le client consommateur dispose d'un délai de quatorze (14) jours à compter de la signature pour exercer son droit de rétractation, sans avoir à motiver sa décision ni à supporter de pénalités (articles L. 221-18 et suivants du code de la consommation).",
        },
        {
          kind: "p",
          visible: "retractation",
          texte:
            "Pour exercer ce droit, le client notifie sa décision par écrit au moyen du formulaire figurant en annexe ou par toute déclaration dénuée d'ambiguïté adressée à l'adresse ou à l'e-mail du prestataire indiqués en tête du contrat.",
        },
        {
          kind: "p",
          visible: "retractation",
          texte:
            "Si le client souhaite que l'exécution commence avant l'expiration de ce délai, il en fait la demande expresse ; il reste alors redevable des prestations déjà réalisées à la date de sa rétractation.",
        },
        {
          // L'article reste présent (la numérotation 1-12 et les renvois
          // internes ne bougent jamais) mais constate l'inapplicabilité.
          kind: "p",
          visible: "sans-retractation",
          texte:
            "Le présent contrat n'étant pas conclu à distance ni hors établissement avec un client consommateur, le droit de rétractation prévu aux articles L. 221-18 et suivants du code de la consommation ne trouve pas à s'appliquer.",
        },
      ],
    },
    {
      numero: 9,
      titre: "ASSURANCES",
      blocs: [
        {
          kind: "p",
          texte:
            "Le prestataire déclare être titulaire des polices d'assurance couvrant sa responsabilité civile professionnelle et sa responsabilité civile décennale pour les activités objet du présent contrat, souscrites auprès de {assureurDecennale} sous le numéro de police {numeroPoliceDecennale}. Une attestation est remise au client sur simple demande.",
        },
        {
          kind: "p",
          texte:
            "Le client déclare pour sa part être assuré au titre des biens et des locaux dans lesquels se trouve l'installation.",
        },
      ],
    },
    {
      numero: 10,
      titre: "RÉSILIATION",
      blocs: [
        {
          kind: "p",
          texte:
            "Outre le cas prévu à l'article 7, le contrat peut être résilié de plein droit :",
        },
        {
          kind: "li",
          items: [
            "en cas de non-paiement d'une facture, dix (10) jours après une mise en demeure par lettre recommandée avec accusé de réception restée sans effet, le prestataire pouvant à son choix suspendre l'exécution du contrat jusqu'au complet paiement ;",
            "en cas d'intervention d'un tiers non habilité sur les équipements couverts, ayant une incidence sur l'objet du contrat ;",
            "en cas de manquement de l'une des parties à ses obligations, huit (8) jours francs après mise en demeure par lettre recommandée avec accusé de réception restée sans effet ;",
            "de plein droit et sans indemnité, en cas de vente du bien, de déménagement du client ou de dépose de l'installation, sur justificatif.",
          ],
        },
      ],
    },
    {
      numero: 11,
      titre: "DONNÉES PERSONNELLES",
      blocs: [
        {
          kind: "p",
          texte:
            "Les données recueillies dans le cadre du présent contrat sont traitées par le prestataire, responsable de traitement, aux seules fins de la gestion du contrat, de la planification des interventions, de la facturation et du respect de ses obligations légales. Elles sont conservées pendant la durée du contrat puis pendant les délais de prescription légale. Le client dispose d'un droit d'accès, de rectification, d'effacement, de limitation et d'opposition qu'il peut exercer à l'adresse e-mail du prestataire, ainsi que du droit d'introduire une réclamation auprès de la CNIL.",
        },
      ],
    },
    {
      numero: 12,
      titre: "MÉDIATION ET LITIGES",
      blocs: [
        {
          kind: "p",
          texte:
            "En cas de difficulté, le client s'adresse en premier lieu au prestataire afin de rechercher une solution amiable.",
        },
        {
          kind: "p",
          visible: "particulier",
          texte:
            "Client consommateur : conformément à l'article L. 612-1 du code de la consommation, le client peut recourir gratuitement au médiateur de la consommation dont relève le prestataire : {mediateur}, après avoir adressé une réclamation écrite au prestataire restée sans réponse satisfaisante pendant deux mois. Le client peut également utiliser la plateforme européenne de règlement en ligne des litiges.",
        },
        {
          kind: "p",
          visible: "professionnel",
          texte:
            "Client professionnel : à défaut d'accord amiable, tout litige relatif à la formation, l'exécution ou l'interprétation du contrat relève de la compétence exclusive du tribunal de commerce de Grenoble.",
        },
        {
          kind: "p",
          texte:
            "Le contrat est soumis au droit français. Il est établi en deux exemplaires originaux, un pour chaque partie.",
        },
      ],
    },
  ],
  annexe: {
    visible: "retractation",
    titre: "ANNEXE — FORMULAIRE DE RÉTRACTATION",
    blocs: [
      {
        kind: "note",
        texte:
          "(À compléter et à renvoyer uniquement si vous souhaitez vous rétracter du contrat, dans un délai de 14 jours à compter de sa signature.)",
      },
      {
        kind: "p",
        texte:
          "À l'attention de {prestataireNom} — {prestataireAdresse} — {prestataireEmail}",
      },
      {
        kind: "p",
        texte:
          "Je vous notifie par la présente ma rétractation du contrat d'entretien n° {numeroContrat} signé le ....../....../..........",
      },
      {
        kind: "p",
        texte:
          "Nom et prénom du client : ..........................................................................................",
      },
      {
        kind: "p",
        texte:
          "Adresse : ..................................................................................................................",
      },
      { kind: "p", texte: "Date : ....../....../.........." },
      {
        kind: "p",
        texte: "Signature (uniquement en cas de notification sur papier) :",
      },
    ],
  },
};
