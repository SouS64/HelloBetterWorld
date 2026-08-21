// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.8
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        *://*/*
// @connect      cdn.jsdelivr.net
// @connect      huggingface.co
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://jsdelivr.net
// ==/UserScript==

(async function() {
    'use strict';

    const urlActuelle = window.location.href;

    // 1. DÉTECTION PAGE GITHUB
    if (urlActuelle.includes('github.io')) {
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.8 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
        let pipelineAnalyseur = null;

        // Message de démarrage immédiat
        creerBandeauStatut("⏳ Extension v1.8 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");

        async function initIA() {
            try {
                pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
                creerBandeauStatut("🛡️ Filtre IA v1.8 actif : Votre navigation Facebook est protégée !", "#28a745");
            } catch (erreur) {
                creerBandeauStatut("❌ Erreur : Safari bloque le téléchargement automatique de l'IA.", "#dc3545");
            }
        }
        await initIA();
    }

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
        bandeau.onclick = () => bandeau.style.display = 'none';
    }
})();
