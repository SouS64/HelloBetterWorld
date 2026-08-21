// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.6
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        https://*://*
// @match        https://m://*
// @match        https://*.github.io/*
// @connect      cdn.jsdelivr.net
// @connect      huggingface.co
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://jsdelivr.net
// ==/UserScript==

(async function() {
    'use strict';

    // 1. TEXTE DE TEST POUR LA PAGE D'ACCUEIL GITHUB
    if (window.location.href.includes('github.io')) {
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.6 est active sur votre page d'accueil.");
        return; // On s'arrête là sur GitHub
    }

    // 2. TEXTE ET LOGIQUE POUR FACEBOOK
    let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
    let pipelineAnalyseur = null;

    // On affiche immédiatement le message "En attente de l'IA"
    creerBandeauStatut("⏳ Extension v1.6 active sur Facebook : Téléchargement de l'IA locale...");

    async function initIA() {
        try {
            pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
            // Si l'IA charge avec succès, on met à jour le texte en vert
            creerBandeauStatut("🛡️ Filtre IA v1.6 actif : Votre navigation Facebook est protégée !", "#28a745");
        } catch (erreur) {
            creerBandeauStatut("❌ Erreur : L'IA n'a pas pu se télécharger localement.", "#dc3545");
        }
    }
    await initIA();

    // Fonction universelle pour créer vos bandeaux de texte d'état
    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            document.body.appendChild(bandeau);
        }
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "position:fixed; bottom:15px; right:15px; left:15px; padding:12px; background:" + couleurFond + "; color:white; border-radius:8px; text-align:center; font-family:sans-serif; font-size:13px; font-weight:bold; z-index:999999; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:auto;";
        
        // Permet de fermer le bandeau en cliquant dessus si besoin
        bandeau.onclick = () => bandeau.style.display = 'none';
    }

    // Le reste du code de filtrage Facebook reste inchangé...
})();
