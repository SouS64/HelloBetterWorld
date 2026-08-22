// ==UserScript==
// @name         Filtre Facebook IA Hybride
// @namespace    http://tampermonkey.net
// @version      2.4
// @description  Filtre local (dictionnaire renforcé + IA externe Groq optionnelle) contre la haine, la moquerie et le spam sur Facebook.
// @author       Votre Nom
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      huggingface.co
// @connect      api.groq.com
// ==/UserScript==

(async function () {
  'use strict';

  const urlActuelle = window.location.href;

  // =========================================================================
  // 1. DÉTECTION PAGE GITHUB (inchangé)
  // =========================================================================
  if (urlActuelle.includes('github.io')) {
    creerBandeauStatut("✅ Ça fonctionne ! L'extension v2.4 est active sur votre page d'accueil.");
    return;
  }

  if (!urlActuelle.includes('facebook.com')) return;

  // =========================================================================
  // 2. ÉTAT GLOBAL
  // =========================================================================
  let compteurMasques = 0; // valeur de secours, écrasée ci-dessous si GM_getValue fonctionne
  try {
    compteurMasques = Number(await GM_getValue('compteurMasques', 0)) || 0;
  } catch (erreur) {
    console.warn("[Filtre FB] GM_getValue indisponible, compteur repart de 0 :", erreur);
  }
  let historiqueBlocages = [];
  let moteurIA = null;          // instance WebLLM si dispo
  let iaLocaleActive = false;   // true seulement si WebLLM a réellement chargé

  // -------------------------------------------------------------------------
  // 2a. DICTIONNAIRE PONDÉRÉ
  // Chaque mot a un "poids". Score cumulé >= SEUIL_FLOU => on masque.
  // -------------------------------------------------------------------------
  const dictionnaireHaine = {
    // insultes directes fortes
    "connard": 5, "connasse": 5, "salope": 5, "pute": 5, "enculé": 5, "fdp": 5,
    "batard": 4, "bâtard": 4, "ordure": 4, "raclure": 4,
    // insultes modérées
    "débile": 3, "idiot": 3, "abruti": 3, "crétin": 3, "gogol": 3, "attardé": 4,
    "cassos": 3, "naze": 2, "moche": 2, "clown": 2, "nul": 2, "pathétique": 2,
    // agressivité / rejet
    "ferme ta": 4, "ta gueule": 5, "casse toi": 3, "dégage": 2,
    // moquerie
    "mdr t": 1, "grosse merde": 5, "sous merde": 5,

    // --- racisme / xénophobie / discrimination ---
    // Volontairement non-exhaustif : on couvre les tournures les plus
    // fréquentes plutôt qu'une liste complète d'insultes ethniques, pour
    // éviter de maintenir ici un catalogue trop détaillé. Complétez cette
    // section vous-même si besoin, en gardant le même format {terme: poids}.
    "sale race": 6, "sale arabe": 6, "sale noir": 6, "sale juif": 6,
    "retourne dans ton pays": 6, "rentre chez toi": 5, "pas de chez nous": 4,
    "race de": 5, "bougnoule": 6, "négro": 6, "youpin": 6, "chintok": 6,
    "sale étranger": 5, "envahisseurs": 4, "grand remplacement": 5,

    // --- déshumanisation ---
    "sous-homme": 6, "sous homme": 6, "pas un être humain": 5,
    "des animaux": 4, "de la vermine": 6, "des rats": 5, "des cafards": 5,
    "des parasites": 5,

    // --- mépris personnel direct (formules figées) ---
    "tu ne vaux rien": 5, "tu es une honte": 5, "quelle honte": 3,
    "tu fais pitié": 4, "tu me dégoûtes": 4, "tu es minable": 4,
    "tu es lamentable": 4, "personne ne t'aime": 5, "tu sers à rien": 5,
    "va crever": 6, "j'espère que tu": 3,

    // --- moquerie sarcastique / dévalorisation par ironie ---
    "neuneu": 3, "neu neu": 3, "fut fut": 3, "futfut": 3, "pas futé": 3,
    "encore un genie": 3, "encore une lumiere": 3, "quel genie": 3,
    "bravo champion": 2, "bien joue einstein": 3,
  };

  const SEUIL_FLOU = 3; // score minimum pour masquer un message

  // -------------------------------------------------------------------------
  // 2a-bis. MOTIFS DE PHRASES (regex) POUR LE MÉPRIS PERSONNEL
  // Capture des tournures du type "tu es <adjectif négatif>" que le simple
  // dictionnaire par mot-clé rate souvent, car c'est la combinaison qui
  // rend la phrase méprisante, pas un mot isolé.
  // -------------------------------------------------------------------------
  const adjectifsNegatifs = [
    "nul", "nulle", "ridicule", "pathetique", "minable", "lamentable",
    "inutile", "stupide", "bete", "conne", "con", "moche", "degueulasse",
    "insignifiant", "mediocre",
  ];
  const regexMeprisPersonnel = new RegExp(
    "\\btu\\s+(es|est|fais|reste)\\s+(un[e]?\\s+)?(" + adjectifsNegatifs.join("|") + ")\\b"
  );
  const POIDS_MEPRIS_PERSONNEL = 4;

  // -------------------------------------------------------------------------
  // 2c. JUGEMENTS SANS ARGUMENT ("c'est nul", "n'importe quoi" sans justification)
  // -------------------------------------------------------------------------
  // Réglages : mettez ACTIVER_FILTRE_NON_CONSTRUCTIF à false pour désactiver
  // entièrement cette section sans toucher au reste du script.
  const ACTIVER_FILTRE_NON_CONSTRUCTIF = true;
  const SEUIL_NON_CONSTRUCTIF = 3; // score minimum pour flouter (léger, réversible visuellement)

  const marqueursJugementAbsolu = [
    "n'importe quoi", "aucun sens", "grand n'importe quoi", "toujours les memes",
    "jamais content", "comme d'habitude", "sans surprise", "evidemment",
    "typique", "on s'en doutait", "quelle blague", "du grand n'importe quoi",
  ];
  const connecteursJustification = [
    "parce que", "car ", "puisque", "etant donne", "en effet", "notamment",
    "par exemple", "ce qui explique", "du fait que", "vu que", "sachant que",
    "d'ailleurs", "preuve en est",
  ];
  const MOTS_MAX_SANS_ARGUMENT = 25; // au-delà, on suppose qu'il y a un minimum de développement
  const POIDS_JUGEMENT_SANS_ARGUMENT = 3;

  function detecterJugementSansArgument(texteOriginal) {
    const t = normaliserTexte(texteOriginal);
    const nbMots = t.split(' ').filter(Boolean).length;
    if (nbMots === 0 || nbMots > MOTS_MAX_SANS_ARGUMENT) return { score: 0, motif: null };

    const contientJugement = marqueursJugementAbsolu.some((m) => t.includes(normaliserTexte(m)));
    if (!contientJugement) return { score: 0, motif: null };

    const contientJustification = connecteursJustification.some((c) => t.includes(normaliserTexte(c)));
    if (contientJustification) return { score: 0, motif: null }; // il y a un minimum d'argumentation, on laisse passer

    return { score: POIDS_JUGEMENT_SANS_ARGUMENT, motif: "jugement à l'emporte-pièce sans argument" };
  }

  // -------------------------------------------------------------------------
  // 2d. HORS-SUJET PAR RAPPORT AU POST (expérimental, best-effort)
  // -------------------------------------------------------------------------
  // ATTENTION (honnêteté technique) : Facebook change régulièrement la
  // structure de ses pages et obfusque ses classes CSS. Cette fonction tente
  // de retrouver le texte du post parent via plusieurs sélecteurs connus,
  // mais elle peut échouer à trouver le post (dans ce cas, elle ne pénalise
  // simplement rien plutôt que de se tromper) ou devenir obsolète si
  // Facebook modifie son balisage. Ajustez SELECTEURS_POST si besoin.
  const SELECTEURS_POST = [
    '[data-ad-preview="message"]',
    '[data-ad-comet-preview="message"]',
    'div[data-testid="post_message"]',
  ];
  const MOTS_VIDES = new Set([
    "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "mais",
    "donc", "car", "ni", "que", "qui", "quoi", "est", "sont", "ce", "cette",
    "ces", "il", "elle", "je", "tu", "nous", "vous", "ils", "elles", "pour",
    "avec", "sans", "sur", "dans", "par", "pas", "plus", "tres", "bien",
  ]);
  const NB_MOTS_SIGNIFICATIFS_MIN = 8; // en dessous, trop court pour juger le sujet fiablement
  const SEUIL_SIMILARITE_MIN = 0.05;   // en dessous de ce ratio de mots communs, on suppose hors-sujet
  const POIDS_HORS_SUJET = 3;

  function extraireMotsSignificatifs(texte) {
    return normaliserTexte(texte)
      .split(' ')
      .filter((m) => m.length > 3 && !MOTS_VIDES.has(m));
  }

  function trouverTextePost(elementCommentaire) {
    for (const selecteur of SELECTEURS_POST) {
      const post = elementCommentaire.closest('[role="article"]')?.querySelector(selecteur)
        || document.querySelector(selecteur);
      if (post && post.innerText && post.innerText.trim().length > 20) {
        return post.innerText;
      }
    }
    return null; // pas de post trouvé de façon fiable : on ne pénalise pas
  }

  function detecterHorsSujet(elementCommentaire, texteCommentaire) {
    const motsCommentaire = extraireMotsSignificatifs(texteCommentaire);
    if (motsCommentaire.length < NB_MOTS_SIGNIFICATIFS_MIN) return { score: 0, motif: null };

    const textePost = trouverTextePost(elementCommentaire);
    if (!textePost) return { score: 0, motif: null }; // pas de référence fiable, on ne juge pas

    const motsPost = new Set(extraireMotsSignificatifs(textePost));
    if (motsPost.size === 0) return { score: 0, motif: null };

    const intersection = motsCommentaire.filter((m) => motsPost.has(m)).length;
    const similarite = intersection / motsPost.size;

    if (similarite < SEUIL_SIMILARITE_MIN) {
      return { score: POIDS_HORS_SUJET, motif: "hors-sujet par rapport au post (best-effort)" };
    }
    return { score: 0, motif: null };
  }

  // -------------------------------------------------------------------------
  // 2b. NORMALISATION ANTI-CONTOURNEMENT
  // Gère accents, leetspeak (0/1/3/4/5/7/@/$) et lettres répétées ("coooonnard")
  // -------------------------------------------------------------------------
  function normaliserTexte(texte) {
    let t = texte.toLowerCase();
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // enlève les accents
    const leet = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
    t = t.replace(/[013457@$]/g, (c) => leet[c] || c);
    t = t.replace(/(.)\1{2,}/g, '$1$1'); // "coooonnard" -> "coonnard" (garde 2 max)
    t = t.replace(/[^a-z\s]/g, ' ');     // enlève ponctuation résiduelle
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  // Cache des regex par mot (créées une seule fois, pas à chaque appel)
  const regexParMotCache = new Map();
  function regexPourMot(motNormalise) {
    if (!regexParMotCache.has(motNormalise)) {
      const echappe = motNormalise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regexParMotCache.set(motNormalise, new RegExp('\\b' + echappe + '\\b'));
    }
    return regexParMotCache.get(motNormalise);
  }

  function scoreToxiciteDictionnaire(texteOriginal) {
    const texteNormalise = normaliserTexte(texteOriginal);
    let score = 0;
    let motsDetectes = [];
    for (const [mot, poids] of Object.entries(dictionnaireHaine)) {
      const motNormalise = normaliserTexte(mot);
      // Limites de mots strictes : "trace de" ne doit PAS matcher "race de".
      if (regexPourMot(motNormalise).test(texteNormalise)) {
        score += poids;
        motsDetectes.push(mot);
      }
    }
    // Motifs de phrases ("tu es nul", "tu fais pitié", etc.)
    if (regexMeprisPersonnel.test(texteNormalise)) {
      score += POIDS_MEPRIS_PERSONNEL;
      motsDetectes.push("mépris personnel (motif de phrase)");
    }
    return { score, motsDetectes };
  }

  // =========================================================================
  // 3. TENTATIVE DE CHARGEMENT D'UNE IA LOCALE (WebLLM, expérimental)
  // -------------------------------------------------------------------------
  // ATTENTION (honnêteté technique) :
  //  - Nécessite WebGPU (navigator.gpu). Absent sur Safari/iOS aujourd'hui,
  //    et Chrome sur iPhone utilise aussi WebKit (donc pas de WebGPU non plus).
  //  - Même quand WebGPU existe (PC / Android Chrome récents), le CSP strict
  //    de facebook.com peut bloquer le chargement de la librairie et/ou le
  //    téléchargement du modèle. Dans ce cas, l'échec est silencieux et le
  //    script continue sur le dictionnaire seul, sans jamais planter.
  // =========================================================================
  async function tenterChargementIALocale() {
    if (!('gpu' in navigator)) {
      return false; // pas de WebGPU dispo (cas iPhone systématiquement)
    }
    try {
      const webllm = await import('https://esm.run/@mlc-ai/web-llm');
      // Modèle volontairement très petit pour rester utilisable sur mobile/PC modeste.
      // Si ce modèle disparaît du catalogue MLC, remplacez son identifiant
      // (liste à jour sur https://mlc.ai/web-llm/).
      const NOM_MODELE = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

      moteurIA = await webllm.CreateMLCEngine(NOM_MODELE, {
        initProgressCallback: () => {}, // silencieux ; pas de log intrusif
      });

      return true;
    } catch (erreur) {
      console.warn("[Filtre FB] IA locale WebLLM indisponible, repli sur le dictionnaire :", erreur);
      moteurIA = null;
      return false;
    }
  }

  async function classifierAvecIALocale(texte) {
    if (!moteurIA) return null;
    try {
      const reponse = await moteurIA.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Tu es un modérateur de commentaires Facebook. Réponds uniquement par TOXIC si le message contient de la haine, une insulte ou une moquerie agressive, sinon réponds CLEAN. Un seul mot, rien d'autre.",
          },
          { role: "user", content: texte },
        ],
        temperature: 0,
        max_tokens: 4,
      });
      const contenu = reponse.choices?.[0]?.message?.content?.toUpperCase() || "";
      return contenu.includes("TOXIC");
    } catch (erreur) {
      return null; // en cas d'erreur ponctuelle, on ne bloque pas le flux
    }
  }

  // =========================================================================
  // 3bis. CLASSIFICATION PAR IA EXTERNE (Groq, gratuit avec quota)
  // -------------------------------------------------------------------------
  // La clé API n'est PAS codée en dur : elle est demandée une seule fois à
  // chaque utilisateur (via une boîte de dialogue), puis stockée localement
  // avec GM_setValue — donc propre à chaque installation du script, jamais
  // partagée entre utilisateurs, jamais visible dans le code téléchargé.
  // =========================================================================
  let GROQ_API_KEY = '';
  const GROQ_MODELE = "llama-3.1-8b-instant";
  const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

  async function chargerOuDemanderCleAPI() {
    try {
      const cleExistante = (await GM_getValue('groqApiKey', '')) || '';
      if (cleExistante) return cleExistante;

      const maintenant = Date.now();
      const declineJusqua = Number(await GM_getValue('groqApiKeyDeclineJusqua', 0)) || 0;
      if (maintenant < declineJusqua) return ''; // décliné récemment, on ne relance pas la demande à chaque page

      const saisie = prompt(
        "🤖 Filtre Facebook IA\n\n" +
        "Pour activer l'analyse IA avancée (gratuite), collez votre clé API Groq ci-dessous.\n\n" +
        "Pas de clé ? Créez-en une gratuitement sur console.groq.com (aucune carte bancaire requise). " +
        "Sans clé, le filtre continue de fonctionner normalement avec son dictionnaire local.\n\n" +
        "Laissez vide pour ignorer (on ne vous redemandera pas avant quelques jours)."
      );

      if (saisie && saisie.trim()) {
        const cle = saisie.trim();
        await GM_setValue('groqApiKey', cle);
        await GM_setValue('groqApiKeyDeclineJusqua', 0);
        return cle;
      } else {
        await GM_setValue('groqApiKeyDeclineJusqua', maintenant + 3 * 24 * 60 * 60 * 1000); // re-demande dans 3 jours
        return '';
      }
    } catch (erreur) {
      console.warn("[Filtre FB] Impossible de charger/demander la clé API Groq :", erreur);
      return '';
    }
  }

  // Reconfiguration à tout moment via le menu de l'extension (disponible sur
  // Tampermonkey desktop ; absent sur Tampermonkey iOS/Safari — sur iPhone,
  // effacez la valeur 'groqApiKey' depuis l'app Tampermonkey > le script >
  // Storage pour redéclencher la demande au prochain chargement de page).
  try {
    GM_registerMenuCommand("🔑 Configurer la clé API Groq", async () => {
      const cleActuelle = (await GM_getValue('groqApiKey', '')) || '';
      const nouvelleCle = prompt("Collez votre clé API Groq (laissez vide pour désactiver cette fonctionnalité) :", cleActuelle);
      if (nouvelleCle !== null) {
        await GM_setValue('groqApiKey', nouvelleCle.trim());
        await GM_setValue('groqApiKeyDeclineJusqua', 0);
        alert("✅ Clé enregistrée. Rechargez la page Facebook pour l'appliquer.");
      }
    });
  } catch (erreur) {
    // GM_registerMenuCommand indisponible sur cette plateforme : pas grave, silencieux.
  }

  // Marge de sécurité volontaire sous la limite Groq réelle (14 400/jour) :
  // avec des lots de 10 commentaires, 500 appels/jour = jusqu'à 5000
  // commentaires classés par jour, largement suffisant en usage personnel.
  const QUOTA_MAX_APPELS_PAR_JOUR = 500;
  const TAILLE_LOT_MAX = 10;
  const INTERVALLE_TRAITEMENT_LOT_MS = 5000; // largement sous la limite 30 req/min de Groq

  const PROMPT_SYSTEME_CLASSIFICATION = `Tu es un modérateur de commentaires Facebook. On te donne une liste de commentaires au format JSON (tableau de chaînes). Pour CHAQUE commentaire, réponds par une étiquette :
- "HAINE" : insulte, racisme, propos dégradant ou déshumanisant
- "NON_CONSTRUCTIF" : moquerie sarcastique envers une personne (ex: "quel génie", "neuneu", "un fut fut" au sens ironique), jugement à l'emporte-pièce sans argument, ou commentaire hors-sujet
- "CLEAN" : commentaire normal, argumenté, ou critique légitime sans mépris

Réponds UNIQUEMENT avec un tableau JSON d'étiquettes, dans le même ordre que les commentaires reçus, sans aucun autre texte. Exemple de réponse : ["CLEAN","HAINE","NON_CONSTRUCTIF"]`;

  let fileAttenteIA = []; // { element, texte }
  let quotaAppelsAujourdhui = 0;
  let dateQuotaCourante = new Date().toDateString();

  async function chargerQuota() {
    try {
      const dateSauvegardee = await GM_getValue('quotaGroqDate', null);
      const aujourdhui = new Date().toDateString();
      if (dateSauvegardee !== aujourdhui) {
        // Nouveau jour : on repart à zéro.
        quotaAppelsAujourdhui = 0;
        dateQuotaCourante = aujourdhui;
        await GM_setValue('quotaGroqDate', aujourdhui);
        await GM_setValue('quotaGroqCompteur', 0);
      } else {
        quotaAppelsAujourdhui = Number(await GM_getValue('quotaGroqCompteur', 0)) || 0;
      }
    } catch (erreur) {
      // Si GM_getValue échoue, on continue avec le compteur en mémoire uniquement.
    }
  }

  async function incrementerQuota() {
    quotaAppelsAujourdhui++;
    try {
      await GM_setValue('quotaGroqCompteur', quotaAppelsAujourdhui);
    } catch (erreur) {
      // Pas grave si la persistance échoue : le compteur en mémoire suffit pour cette session.
    }
  }

  function ajouterALaFileIA(element, texte) {
    if (!GROQ_API_KEY) return; // pas configuré
    const nbMots = texte.trim().split(/\s+/).length;
    if (nbMots < 3 || nbMots > 60) return; // trop court pour être ambigu, ou trop long (coûte cher en tokens)
    if (fileAttenteIA.some((item) => item.element === element)) return;
    fileAttenteIA.push({ element, texte });
  }

  function classifierLotAvecGroq(textes) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: GROQ_ENDPOINT,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + GROQ_API_KEY,
        },
        data: JSON.stringify({
          model: GROQ_MODELE,
          temperature: 0,
          max_tokens: 300,
          messages: [
            { role: "system", content: PROMPT_SYSTEME_CLASSIFICATION },
            { role: "user", content: JSON.stringify(textes) },
          ],
        }),
        timeout: 15000,
        onload: (reponse) => {
          try {
            const data = JSON.parse(reponse.responseText);
            const contenu = data.choices?.[0]?.message?.content || "[]";
            const labels = JSON.parse(contenu.trim());
            resolve(Array.isArray(labels) ? labels : null);
          } catch (erreur) {
            console.warn("[Filtre FB] Réponse Groq illisible, lot ignoré :", erreur);
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  async function traiterFileIA() {
    if (fileAttenteIA.length === 0) return;
    if (!GROQ_API_KEY) return;

    await chargerQuota();
    if (quotaAppelsAujourdhui >= QUOTA_MAX_APPELS_PAR_JOUR) return; // quota épuisé pour aujourd'hui, on n'appelle plus

    const lot = fileAttenteIA.splice(0, TAILLE_LOT_MAX);
    const resultats = await classifierLotAvecGroq(lot.map((item) => item.texte));
    if (!resultats || resultats.length !== lot.length) return; // échec ou réponse incohérente : on abandonne ce lot sans planter

    await incrementerQuota();

    for (let i = 0; i < lot.length; i++) {
      const label = resultats[i];
      if (label === "HAINE") {
        await appliquerFloutage(lot[i].element, lot[i].texte, "IA externe (Groq) : haine/insulte", "fort");
      } else if (label === "NON_CONSTRUCTIF") {
        await appliquerFloutage(lot[i].element, lot[i].texte, "IA externe (Groq) : non constructif", "leger");
      }
    }
  }

  // =========================================================================
  // 4. INITIALISATION
  // =========================================================================
  window.addEventListener('load', async () => {
    creerBandeauStatut(`⏳ Extension v2.4 active : chargement du filtre (💬 ${compteurMasques} masqués)…`, "#ff9800");

    GROQ_API_KEY = await chargerOuDemanderCleAPI();
    iaLocaleActive = await tenterChargementIALocale();
    majBandeau();
    lancerSurveillancePage();
  });

  // =========================================================================
  // 5. SURVEILLANCE DE LA PAGE
  // =========================================================================
  function lancerSurveillancePage() {
    async function inspecterCommentaires() {
      const elementsTexte = document.querySelectorAll(
        'span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v])'
      );

      for (const el of elementsTexte) {
        el.setAttribute('data-ia-v', 'true');
        if (!el.innerText || el.innerText.trim().length < 5 || el.children.length > 1) continue;

        const texteOriginal = el.innerText;

        // Étape 1 : dictionnaire (haine, racisme, mépris), toujours exécuté
        const { score, motsDetectes } = scoreToxiciteDictionnaire(texteOriginal);
        if (score >= SEUIL_FLOU) {
          await appliquerFloutage(el, texteOriginal, `Dictionnaire (score ${score}: ${motsDetectes.join(', ')})`, "fort");
          continue;
        }

        // Étape 2 : IA locale, seulement si elle a réellement chargé
        if (iaLocaleActive && moteurIA) {
          const estToxique = await classifierAvecIALocale(texteOriginal);
          if (estToxique) {
            await appliquerFloutage(el, texteOriginal, "IA locale (WebLLM)", "fort");
            continue;
          }
        }

        // Étape 3 : contenu non constructif local (jugement sans argument / hors-sujet)
        let dejaClasse = false;
        if (ACTIVER_FILTRE_NON_CONSTRUCTIF) {
          const jugement = detecterJugementSansArgument(texteOriginal);
          const horsSujet = detecterHorsSujet(el, texteOriginal);
          const scoreNonConstructif = jugement.score + horsSujet.score;
          if (scoreNonConstructif >= SEUIL_NON_CONSTRUCTIF) {
            const motifs = [jugement.motif, horsSujet.motif].filter(Boolean).join(' + ');
            await appliquerFloutage(el, texteOriginal, motifs, "leger");
            dejaClasse = true;
          }
        }

        // Étape 4 : rien de local ne s'est déclenché → on met en file pour l'IA
        // externe Groq, qui peut attraper les cas subtils (sarcasme, ironie
        // du type "neuneu"/"un fut fut"/"encore un génie") que les règles
        // locales ratent. Traité par lots toutes les 5 secondes, pas ici.
        if (!dejaClasse) {
          ajouterALaFileIA(el, texteOriginal);
        }
      }
    }
    setInterval(inspecterCommentaires, 1500);
    setInterval(traiterFileIA, INTERVALLE_TRAITEMENT_LOT_MS);
  }

  // =========================================================================
  // 6. FLOUTAGE + PERSISTANCE
  // =========================================================================
  async function appliquerFloutage(element, texte, raison, intensite = "fort") {
    if (element.style.filter.includes("blur")) return;

    if (intensite === "leger") {
      element.style.filter = "blur(3px)";
      element.style.opacity = "0.45";
    } else {
      element.style.filter = "blur(7px)";
      element.style.opacity = "0.15";
    }
    element.style.transition = "all 0.3s ease";

    compteurMasques++;
    try {
      await GM_setValue('compteurMasques', compteurMasques);
    } catch (erreur) {
      console.warn("[Filtre FB] GM_setValue indisponible, le compteur ne sera pas sauvegardé :", erreur);
    }

    if (!historiqueBlocages.some((h) => h.texte === texte)) {
      historiqueBlocages.push({ texte, raison });
    }
    majBandeau();
  }

  function majBandeau() {
    const bandeau = document.getElementById('ia-bandeau-statut');
    if (!bandeau) return;
    let labelMode = iaLocaleActive ? "Dictionnaire + IA locale" : "Dictionnaire renforcé";
    if (GROQ_API_KEY) {
      labelMode += ` + Groq (${quotaAppelsAujourdhui}/${QUOTA_MAX_APPELS_PAR_JOUR})`;
    }
    bandeau.innerHTML = `⚙️ 🛡️ Filtre v2.4 actif : ${labelMode} (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`;
    bandeau.style.background = "#28a745";
    bandeau.onclick = (e) => {
      e.stopPropagation();
      window.afficherResumeFiltre();
    };
  }

  window.afficherResumeFiltre = function () {
    if (historiqueBlocages.length === 0) {
      alert("📝 Aucun élément n'a encore été masqué par le filtre.");
      return;
    }
    let texteResume = `📝 RÉSUMÉ DES ÉLÉMENTS MASQUÉS :\n\n`;
    historiqueBlocages.forEach((item, index) => {
      texteResume += `${index + 1}) [${item.raison}] "${item.texte.substring(0, 60)}..."\n\n`;
    });
    alert(texteResume);
  };

  // =========================================================================
  // 7. BANDEAU DE STATUT
  // =========================================================================
  function creerBandeauStatut(message, couleurFond = "#1877f2") {
    let bandeau = document.getElementById('ia-bandeau-statut');
    if (!bandeau) {
      bandeau = document.createElement('div');
      bandeau.id = 'ia-bandeau-statut';
      document.body.insertBefore(bandeau, document.body.firstChild);
    }
    bandeau.innerHTML = "⚙️ " + message;
    bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important; cursor:pointer;";
  }
})();
