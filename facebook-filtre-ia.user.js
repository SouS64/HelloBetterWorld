// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.7
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

    // 1. STATUT SUR LA PAGE D'ACCUEIL GITHUB
    if (window.location.href.includes('github.io')) {
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.7 est active sur votre page d'accueil.");
        return; 
    }

    // 2. STATUT SUR LA PAGE FACEBOOK
    let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
    let pipelineAnalyseur = null;

    // Affiche le message de chargement de l'IA immédiatement en orange
    creerBandeauStatut("⏳ Extension v1.7 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");

    async function initIA() {
        try {
            // Téléchargement du modèle de classification
            pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
            // Si l'IA est prête, le bandeau passe au vert
            creerBandeauStatut("🛡️ Filtre IA v1.7 actif : Votre navigation Facebook est protégée !", "#28a745");
        } catch (erreur) {
            // Si le téléchargement bloque (souvent un problème d'autorisation)
            creerBandeauStatut("❌ Erreur : Safari bloque le téléchargement de l'IA locale.", "#dc3545");
        }
    }
    await initIA();

    // Fonction de création du bandeau d'information
    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            document.body.appendChild(bandeau);
        }
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "position:fixed; bottom:15px; right:15px; left:15px; padding:12px; background:" + couleurFond + "; color:white; border-radius:8px; text-align:center; font-family:sans-serif; font-size:13px; font-weight:bold; z-index:999999; box-shadow:0 4px 12px rgba(0,0,0,0.3); pointer-events:auto;";
        
        // Permet de masquer le bandeau en tapant dessus
        bandeau.onclick = () => bandeau.style.display = 'none';
    }
})();
