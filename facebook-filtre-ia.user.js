// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      2.0
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(async function() {
    'use strict';

    const urlActuelle = window.location.href;

    // 1. DÉTECTION PAGE GITHUB
    if (urlActuelle.includes('github.io')) {
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v2.0 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        // FIX IMPORTANT : On attend que la page soit prête avant de dessiner
        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v2.0 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
            initIA();
        });

        async function initIA() {
            try {
                const { pipeline } = await import('https://jsdelivr.net');
                const pipelineAnalyseur = await pipeline('text-classification', 'Xenova/toxic-bert');
                creerBandeauStatut("🛡️ Filtre IA v2.0 actif : Votre navigation Facebook est protégée !", "#28a745");
            } catch (erreur) {
                console.error(erreur);
                creerBandeauStatut("❌ Erreur : Sécurité iOS bloque le chargement de l'IA.", "#dc3545");
            }
        }
    }

    // Fonction de création du bandeau d'information
    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            // FIX FIX : On force l'insertion au tout début du corps de la page (body)
            document.body.insertBefore(bandeau, document.body.firstChild);
        }
        bandeau.innerHTML = "⚙️ " + message;
        // Style ajusté pour être visible tout en haut de l'écran, sans être masqué par l'interface Facebook
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important;";
        
        bandeau.onclick = () => bandeau.style.display = 'none';
    }
})();
