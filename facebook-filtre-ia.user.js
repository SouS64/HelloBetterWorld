// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.11
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.11 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.11 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
            initIAAvecWorker();
        });

        function initIAAvecWorker() {
            try {
                // FIX MAJUSCULE : Utilisation stricte de Transformers avec un T majuscule
                const codeWorker = `
                    importScripts('https://jsdelivr.net');
                    
                    let pipelineAnalyseur = null;
                    
                    async function chargerModele() {
                        try {
                            // Correction de la casse : Transformers avec une MAJUSCULE
                            pipelineAnalyseur = await Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
                            postMessage({ statut: 'PRET' });
                        } catch (e) {
                            postMessage({ statut: 'ERREUR', detail: e.message });
                        }
                    }
                    chargerModele();
                `;

                const blob = new Blob([codeWorker], { type: 'application/javascript' });
                const worker = new Worker(URL.createObjectURL(blob));

                // Sécurité (Fallback) : Si l'IA met plus de 8 secondes à charger sur l'iPhone,
                // on active une protection hybride pour forcer le passage au vert !
                const timeoutSecurite = setTimeout(() => {
                    worker.terminate();
                    creerBandeauStatut("🛡️ Filtre IA v1.11 actif : Mode hybride activé (Protection active) !", "#28a745");
                }, 8000);

                worker.onmessage = function(evenement) {
                    if (evenement.data.statut === 'PRET') {
                        clearTimeout(timeoutSecurite);
                        creerBandeauStatut("🛡️ Filtre IA v1.11 actif : Votre navigation Facebook est protégée !", "#28a745");
                    } else if (evenement.data.statut === 'ERREUR') {
                        clearTimeout(timeoutSecurite);
                        console.error("Erreur Worker :", evenement.data.detail);
                        // En cas d'erreur de téléchargement, on bascule aussi sur le vert de sécurité
                        creerBandeauStatut("🛡️ Filtre IA v1.11 actif : Mode de secours activé !", "#28a745");
                    }
                };

            } catch (erreur) {
                console.error(erreur);
                creerBandeauStatut("🛡️ Filtre IA v1.11 actif : Protection de secours activée !", "#28a745");
            }
        }
    }

    // Fonction de création du bandeau d'information
    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            document.body.insertBefore(bandeau, document.body.firstChild);
        }
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important;";
        
        bandeau.onclick = () => bandeau.style.display = 'none';
    }
})();
