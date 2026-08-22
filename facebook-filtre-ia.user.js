// ==UserScript==
// @name         Filtre Facebook IA Hybride
// @namespace    http://tampermonkey.net
// @version      2.1
// @description  Filtre local (dictionnaire renforcé + IA embarquée optionnelle via WebLLM) contre la haine, la moquerie et le spam sur Facebook.
// @author       Votre Nom
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      raw.githubusercontent.com
// @connect      huggingface.co
// ==/UserScript==

(async function () {
  'use strict';

  const urlActuelle = window.location.href;

  // =========================================================================
  // 1. DÉTECTION PAGE GITHUB (inchangé)
  // =========================================================================
  if (urlActuelle.includes('github.io')) {
    creerBandeauStatut("✅ Ça fonctionne ! L'extension v2.0 est active sur votre page d'accueil.");
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

  function scoreToxiciteDictionnaire(texteOriginal) {
    const texteNormalise = normaliserTexte(texteOriginal);
    let score = 0;
    let motsDetectes = [];
    for (const [mot, poids] of Object.entries(dictionnaireHaine)) {
      const motNormalise = normaliserTexte(mot);
      if (texteNormalise.includes(motNormalise)) {
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
  // 4. INITIALISATION
  // =========================================================================
  window.addEventListener('load', async () => {
    creerBandeauStatut(`⏳ Extension v2.0 active : chargement du filtre (💬 ${compteurMasques} masqués)…`, "#ff9800");

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

        // Étape 1 : dictionnaire, toujours exécuté (rapide, fiable, gratuit)
        const { score, motsDetectes } = scoreToxiciteDictionnaire(texteOriginal);
        if (score >= SEUIL_FLOU) {
          await appliquerFloutage(el, texteOriginal, `Dictionnaire (score ${score}: ${motsDetectes.join(', ')})`);
          continue;
        }

        // Étape 2 : IA locale, seulement si elle a réellement chargé
        if (iaLocaleActive && moteurIA) {
          const estToxique = await classifierAvecIALocale(texteOriginal);
          if (estToxique) {
            await appliquerFloutage(el, texteOriginal, "IA locale (WebLLM)");
          }
        }
      }
    }
    setInterval(inspecterCommentaires, 1500);
  }

  // =========================================================================
  // 6. FLOUTAGE + PERSISTANCE
  // =========================================================================
  async function appliquerFloutage(element, texte, raison) {
    if (element.style.filter.includes("blur")) return;

    element.style.filter = "blur(7px)";
    element.style.opacity = "0.15";
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
    const labelMode = iaLocaleActive ? "Dictionnaire + IA locale" : "Dictionnaire renforcé";
    bandeau.innerHTML = `⚙️ 🛡️ Filtre v2.0 actif : ${labelMode} (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`;
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
