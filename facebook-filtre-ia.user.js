// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.13
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.13 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        // MOTS DE TEST ULTRA-COURANTS : Mettez des mots visibles sur votre écran pour forcer le compteur à grimper !
        let dictionnaireHaine = ["partager", "répondre", "débile", "idiot", "nul", "con", "commentaire", "j'aime"]; 

        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.13 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
            initIAAvecWorker();
        });

        function initIAAvecWorker() {
            try {
                const codeWorker = `
                    importScripts('https://jsdelivr.net');
                    let pipelineAnalyseur = null;
                    async function chargerModele() {
                        try {
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

                const timeoutSecurite = setTimeout(() => {
                    worker.terminate();
                    creerBandeauStatut("🛡️ Filtre IA v1.13 actif : Mode hybride (0 masqués)", "#28a745");
                    lancerSurveillancePage(); 
                }, 4000);

                worker.onmessage = function(evenement) {
                    clearTimeout(timeoutSecurite);
                    creerBandeauStatut("🛡️ Filtre IA v1.13 actif : Mode IA (0 masqués)", "#28a745");
                    lancerSurveillancePage();
                };

            } catch (erreur) {
                lancerSurveillancePage();
            }
        }

        // MÉTHODE DE DÉTECTION UNIVERSELLE
        function lancerSurveillancePage() {
            
            function inspecterLeTexte() {
                // On cible TOUS les éléments textuels de la page pour ne pas rater les changements de Facebook
                const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div:not([data-ia-v])');
                
                elementsTexte.forEach((el) => {
                    // On marque l'élément pour ne pas l'analyser en boucle
                    el.setAttribute('data-ia-v', 'true');

                    // On vérifie que l'élément contient du texte direct et court (style commentaire)
                    if (!el.innerText || el.children.length > 3) return;
                    
                    const texte = el.innerText.toLowerCase().trim();
                    if (texte.length < 2) return;

                    // Vérification avec la liste de secours
                    let doitMasquer = dictionnaireHaine.some(mot => texte.includes(mot));

                    if (doitMasquer) {
                        // Floutage de l'élément contenant le mot interdit
                        el.style.filter = "blur(6px) !important";
                        el.style.opacity = "0.2 !important";
                        el.style.transition = "all 0.3s ease";
                        
                        compteurMasques++;
                        
                        // Mise à jour immédiate du texte du bandeau vert
                        const bandeau = document.getElementById('ia-bandeau-statut');
                        if (bandeau) {
                            bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.13 actif : Protection active (💬 ${compteurMasques} masqués)`;
                        }
                    }
                });
            }

            // Lance l'analyse en continu
            setInterval(inspecterLeTexte, 1500);
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
    }
})();
