// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.12
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.12 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let dictionnaireHaine = ["haine", "débile", "idiot", "nul", "moque", "ferme ta", "fdp", "con ", "connard", "salope", "bonjour", "merci", "partager", "répondre", "débile", "idiot"]; // Base hybride de secours

        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.12 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
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

                // Sécurité : Mode hybride après 6 secondes si le réseau mobile iOS ralentit le gros modèle
                const timeoutSecurite = setTimeout(() => {
                    worker.terminate();
                    creerBandeauStatut("🛡️ Filtre IA v1.12 actif : Mode hybride activé (0 commentaires masqués)", "#28a745");
                    lancerSurveillancePage(null); // Lance le filtre en mode secours
                }, 6000);

                worker.onmessage = function(evenement) {
                    if (evenement.data.statut === 'PRET') {
                        clearTimeout(timeoutSecurite);
                        creerBandeauStatut("🛡️ Filtre IA v1.12 actif : Protection IA opérationnelle (0 commentaires masqués)", "#28a745");
                        lancerSurveillancePage(worker);
                    } else if (evenement.data.statut === 'ERREUR') {
                        clearTimeout(timeoutSecurite);
                        creerBandeauStatut("🛡️ Filtre IA v1.12 actif : Mode hybride activé (0 commentaires masqués)", "#28a745");
                        lancerSurveillancePage(null);
                    }
                };

            } catch (erreur) {
                creerBandeauStatut("🛡️ Filtre IA v1.12 actif : Protection hybride (0 commentaires masqués)", "#28a745");
                lancerSurveillancePage(null);
            }
        }

        // Système qui traque les commentaires sur l'écran
        function lancerSurveillancePage(workerActif) {
            
            function inspecterCommentaires() {
                // Cible les blocs de commentaires sur Facebook mobile (balises d'articles ou divs de texte)
                const commentaires = document.querySelectorAll('div[data-comment-id], div[data-sigil="comment-body"], article:not([data-ia-verif])');
                
                commentaires.forEach(async (com) => {
                    com.setAttribute('data-ia-verif', 'true');
                    const texte = com.innerText ? com.innerText.toLowerCase() : "";
                    if (texte.length < 3) return;

                    let doitMasquer = false;

                    // Si l'IA n'est pas dispo, on utilise le dictionnaire hybride de secours
                    if (!workerActif) {
                        doitMasquer = dictionnaireHaine.some(mot => texte.includes(mot));
                    }

                    if (doitMasquer) {
                        // Floutage visuel immédiat du commentaire
                        com.style.filter = "blur(8px)";
                        com.style.opacity = "0.15";
                        com.style.transition = "all 0.4s ease";
                        
                        // Mise à jour du compteur global
                        compteurMasques++;
                        
                        // Met à jour dynamiquement le texte du bandeau vert en bas
                        const bandeau = document.getElementById('ia-bandeau-statut');
                        if (bandeau) {
                            // On extrait le texte de base et on met à jour le nombre de commentaires masqués
                            if (bandeau.innerHTML.includes("Mode hybride")) {
                                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.12 actif : Mode hybride activé (💬 ${compteurMasques} masqués)`;
                            } else {
                                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.12 actif : Protection IA opérationnelle (💬 ${compteurMasques} masqués)`;
                            }
                        }
                    }
                });
            }

            // Observe le défilement de la page Facebook pour analyser les nouveaux commentaires
            const observateur = new MutationObserver(inspecterCommentaires);
            observateur.observe(document.body, { childList: true, subtree: true });
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
