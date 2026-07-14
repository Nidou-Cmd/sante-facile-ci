# PLAN DE TRÉSORERIE MENSUEL — 24 MOIS
### Santé Facile — document destiné aux banques et à la garantie SGPME
*Version 2.0 — 14 juillet 2026 — Modèle piloté par inducteurs (driver-based) avec analyse de sensibilité à 3 scénarios. Devise : FCFA (XOF). Départ : juillet 2026.*

> ⚠️ **Modèle d'hypothèses, pas une promesse.** Tous les inducteurs sont explicites et modifiables (fichier CSV joint, 3 scénarios). À faire relire par un expert-comptable avant dépôt bancaire. Aucun chiffre n'est garanti.

## 1. Stratégie financière moderne appliquée

- **Modèle piloté par inducteurs (driver-based)** : chaque revenu découle d'un inducteur mesurable (patients actifs × taux d'ordonnance × commission), pas d'un chiffre « posé ».
- **Analyse de sensibilité à 3 scénarios (stress test)** : le nombre de patients actifs — inducteur le plus incertain — est testé à **-30 % (Prudent)**, **valeur de référence (Base)** et **+40 % (Optimiste)**, charges et calendrier de financement identiques dans les 3 cas (méthode « toutes choses égales », qui isole le risque commercial du risque de coûts, contractuellement plus stables).
- **Financement non dilutif séquencé + réserve de prudence** : les tranches arrivent avant les pics de dépense ; une **réserve de prudence de 1,5 M FCFA** a été ajoutée à la tranche de M11 spécifiquement pour sécuriser le scénario Prudent (voir §3).
- **Apport personnel affiché (skin in the game)** : 4 M FCFA au démarrage.

## 2. Comparatif des 3 scénarios (24 mois)

| Scénario | Hypothèse patients | Revenus cumulés | Trésorerie minimale | Mois du creux | Trésorerie finale (M24) | Point mort opérationnel |
|---|---|---|---|---|---|---|
| **Prudent** | -30 % vs référence | 35 232 800 FCFA | ✅ 659 850 FCFA | M21 | 1 340 300 FCFA | M22 |
| **Base** | Référence | 48 831 500 FCFA | ✅ 2 136 250 FCFA | M1 | 14 939 000 FCFA | M19 |
| **Optimiste** | +40 % vs référence | 66 964 100 FCFA | ✅ 2 136 250 FCFA | M1 | 33 071 600 FCFA | M17 |

## 3. Lecture du scénario Prudent — risque identifié et mitigation

Sans ajustement, une baisse de 30 % de l'acquisition patients ferait passer la trésorerie **temporairement négative** (creux ≈ -840 000 FCFA au mois M21) avant que le point mort ne soit atteint. **Mitigation appliquée** : une réserve de prudence de **+1,5 M FCFA** a été intégrée à la tranche de financement de M11 (portant le financement total demandé de 39,0 M à **40 500 000 FCFA**, soit +3,8 %). Avec cet ajustement, le scénario Prudent reste positif avec un coussin de sécurité (~+660 000 FCFA au creux).

> 💡 **Pourquoi présenter un scénario qui échoue avant correction ?** Parce qu'un stress test qui « réussit toujours » n'est pas crédible. Montrer le risque puis sa mitigation chiffrée est ce qu'attend un comité de crédit ou un jury sérieux — c'est un signe de rigueur, pas une faiblesse.

## 4. Indicateurs clés — scénario Base (référence)

| Indicateur | Valeur |
|---|---|
| Revenus cumulés | **48 831 500 FCFA** |
| Financements mobilisés (apport + bourses + réserve) | **40 500 000 FCFA** |
| Trésorerie minimale (creux) | **2 136 250 FCFA — jamais négative ✅** |
| Trésorerie finale (M24) | **14 939 000 FCFA** |
| Point mort opérationnel | **M19** |

## 5. Hypothèses (toutes modifiables — voir CSV joint)

- Patients actifs (fin de mois, scénario Base) : de 0 à 2 000 en M12, puis 12 000 en M24 ; Prudent = ×0,70 ; Optimiste = ×1,40.
- Ordonnances livrées = actifs × **0,4**/mois ; commission plateforme = **5 %** × panier **8 000 FCFA** = **400 FCFA**/ordonnance.
- Consultations premium = actifs × **0,5**/mois ; part plateforme = **500 FCFA**.
- Assurance/B2B : dès M10, ~30 FCFA/actif + contrats employeurs B2B2C en Année 2 (M15, M19).
- Charges (identiques dans les 3 scénarios) : équipe, juridique/conformité, intégrations paiement+vidéo, marketing/acquisition, incitations partenaires, infra, imprévus 5 %.
- Financement : apport 4 M (M1) ; 12 M (M2) ; 11 M (M6) ; **13,5 M dont 1,5 M de réserve de prudence (M11)**.

## 6. Tableau de trésorerie mensuel détaillé — scénario Base (FCFA)

| Mois | Patients actifs | Revenus | Financements | Charges totales | Solde net | Trésorerie cumulée |
|---|---|---|---|---|---|---|
| M1 (jul-26) | 0 | 0 | 4 000 000 | 1 863 750 | 2 136 250 | 2 136 250 |
| M2 (aoû-26) | 0 | 0 | 12 000 000 | 2 231 250 | 9 768 750 | 11 905 000 |
| M3 (sep-26) | 50 | 20 500 | 0 | 3 281 250 | -3 260 750 | 8 644 250 |
| M4 (oct-26) | 200 | 82 000 | 0 | 4 121 250 | -4 039 250 | 4 605 000 |
| M5 (nov-26) | 400 | 164 000 | 0 | 2 231 250 | -2 067 250 | 2 537 750 |
| M6 (déc-26) | 650 | 266 500 | 11 000 000 | 2 336 250 | 8 930 250 | 11 468 000 |
| M7 (jan-27) | 900 | 369 000 | 0 | 2 441 250 | -2 072 250 | 9 395 750 |
| M8 (fév-27) | 1 150 | 471 500 | 0 | 2 546 250 | -2 074 750 | 7 321 000 |
| M9 (mar-27) | 1 400 | 574 000 | 0 | 2 651 250 | -2 077 250 | 5 243 750 |
| M10 (avr-27) | 1 650 | 726 000 | 0 | 2 651 250 | -1 925 250 | 3 318 500 |
| M11 (mai-27) | 1 850 | 814 000 | 13 500 000 | 2 651 250 | 11 662 750 | 14 981 250 |
| M12 (jun-27) | 2 000 | 880 000 | 0 | 2 651 250 | -1 771 250 | 13 210 000 |
| M13 (jul-27) | 2 600 | 1 144 000 | 0 | 3 176 250 | -2 032 250 | 11 177 750 |
| M14 (aoû-27) | 3 400 | 1 496 000 | 0 | 3 281 250 | -1 785 250 | 9 392 500 |
| M15 (sep-27) | 4 300 | 2 092 000 | 0 | 3 281 250 | -1 189 250 | 8 203 250 |
| M16 (oct-27) | 5 300 | 2 532 000 | 0 | 3 491 250 | -959 250 | 7 244 000 |
| M17 (nov-27) | 6 400 | 3 016 000 | 0 | 3 491 250 | -475 250 | 6 768 750 |
| M18 (déc-27) | 7 500 | 3 500 000 | 0 | 3 596 250 | -96 250 | 6 672 500 |
| M19 (jan-28) | 8 600 | 4 234 000 | 0 | 3 596 250 | 637 750 | 7 310 250 |
| M20 (fév-28) | 9 600 | 4 674 000 | 0 | 3 701 250 | 972 750 | 8 283 000 |
| M21 (mar-28) | 10 500 | 5 070 000 | 0 | 3 701 250 | 1 368 750 | 9 651 750 |
| M22 (avr-28) | 11 200 | 5 378 000 | 0 | 3 806 250 | 1 571 750 | 11 223 500 |
| M23 (mai-28) | 11 700 | 5 598 000 | 0 | 3 806 250 | 1 791 750 | 13 015 250 |
| M24 (jun-28) | 12 000 | 5 730 000 | 0 | 3 806 250 | 1 923 750 | 14 939 000 |

## 7. Utilisation avec la SGPME et la banque

1. Ce plan (3 scénarios) + le business plan (dossier de financement §5-13) + états financiers dès le 1er exercice + RCCM et attestation fiscale à jour → **déposer la demande de crédit auprès d'une banque partenaire SGPME** (Ecobank, NSIA, BOA, BNI, Coris, Afriland, Advans...).
2. Préciser la sollicitation de la **garantie SGPME** : couverture **50 à 80 %** du risque (commission 1 à 1,5 %).
3. Le crédit bancaire n'est pertinent qu'en **Année 2**, après premiers revenus récurrents. En Année 1, privilégier les **bourses non dilutives**.
4. L'analyse à 3 scénarios démontre au prêteur que le plan a été **stress-testé** et qu'une mitigation chiffrée existe pour le cas défavorable — argument de sérieux central du dossier.

*CSV consolidé joint (3 scénarios, 24 mois) : `plan-tresorerie-24-mois.csv` — réimportable dans Excel / Google Sheets.*