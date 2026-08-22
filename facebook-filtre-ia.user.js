// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.14
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.14 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = []; // Stocke les phrases bloquées
        let modeIAOperationnel = false;
        let dictionnaireHaine = ["débile", "idiot", "nul", "ferme ta", "fdp", "connard", "salope", "cassos", "pauvre naze", "moche", "clown", "gogol"]; 

        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.14 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
            initIAAvecWorker();
        });

        function initIAAvecWorker() {
            try {
                // Code de l'assistant virtuel IA (Web Worker)
                const codeWorker = `
                    importScripts('https://jsdelivr.net');
                    let pipelineAnalyseur = null;
                    
                    async function chargerModele() {
                        try {
                            // Chargement d'un modèle linguistique local ultra-léger de classification
                            pipelineAnalyseur = await Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
                            postMessage({ statut: 'PRET' });
                        } catch (e) {
                            postMessage({ statut: 'ERREUR', detail: e.message });
                        }
                    }
                    chargerModele();

                    // Écoute les demandes d'analyses de textes envoyées par Facebook
                    onmessage = async function(e) {
                        if (!pipelineAnalyseur) return;
                        try {
                            const resultats = await pipelineAnalyseur(e.data.texte);
                            // Le modèle renvoie un score de toxicité entre 0 et 1
                            if (resultats && resultats[0]) {
                                postMessage({ 
                                    statut: 'ANALYSE', 
                                    id: e.data.id,
                                    label: resultats[0].label, 
                                    score: resultats[0].score 
                                });
                            }
                        } catch(err) {}
                    };
                `;

                const blob = new Blob([codeWorker], { type: 'application/javascript' });
                const worker = new Worker(URL.createObjectURL(blob));

                // Sécurité : Si le réseau mobile de l'iPhone ralentit le chargement de l'IA (plus de 6s)
                const timeoutSecurite = setTimeout(() => {
                    worker.terminate();
                    modeIAOperationnel = false;
                    creerBandeauStatut("🛡️ Filtre IA v1.14 actif : Mode hybride de secours (💬 0 masqués)", "#28a745");
                    lancerSurveillancePage(null); 
                }, 6000);

                worker.onmessage = function(evenement) {
                    // Cas 1 : L'IA confirme qu'elle est prête
                    if (evenement.data.statut === 'PRET') {
                        clearTimeout(timeoutSecurite);
                        modeIAOperationnel = true;
                        creerBandeauStatut("🛡️ Filtre IA v1.14 actif : Protection par Intelligence Artificielle (💬 0 masqués)", "#28a745");
                        lancerSurveillancePage(worker);
                    } 
                    // Cas 2 : L'IA renvoie le résultat d'analyse d'un texte
                    else if (evenement.data.statut === 'ANALYSE') {
                        const el = document.querySelector('[data-ia-id="' + evenement.data.id + '"]');
                        if (!el) return;

                        // Si l'IA estime que la phrase est "toxic" avec une forte certitude
                        if (evenement.data.label === 'toxic' && evenement.data.score > 0.60) {
                            appliquerFloutage(el, el.innerText, "IA - " + Math.round(evenement.data.score * 100) + "% de toxicité");
                        }
                    }
                };

            } catch (erreur) {
                lancerSurveillancePage(null);
            }
        }

        // Surveillance continue de l'écran
        function lancerSurveillancePage(workerActif) {
            function inspecterCommentaires() {
                const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v]), div[data-comment-id]:not([data-ia-v])');
                
                elementsTexte.forEach((el) => {
                    el.setAttribute('data-ia-v', 'true');
                    if (!el.innerText || el.innerText.trim().length < 4 || el.children.length > 2) return;
                    
                    const texteOriginal = el.innerText;
                    const texteNettoye = texteOriginal.toLowerCase().trim();

                    // Mode 1 : Analyse par Intelligence Artificielle active
                    if (modeIAOperationnel && workerActif) {
                        const uniqueId = "id_" + Math.random().toString(36).substr(2, 9);
                        el.setAttribute('data-ia-id', uniqueId);
                        workerActif.postMessage({ texte: texteOriginal, id: uniqueId });
                    } 
                    // Mode 2 : Secours par dictionnaire hybride
                    else {
                        let estToxique = dictionnaireHaine.some(mot => texteNettoye.includes(mot));
                        if (estToxique) {
                            appliquerFloutage(el, texteOriginal, "Dictionnaire de secours");
                        }
                    }
                });
            }
            setInterval(inspecterCommentaires, 1500);
        }

        // Masquage visuel et enregistrement dans l'historique
        function appliquerFloutage(element, texte, raison) {
            element.style.filter = "blur(7px)";
            element.style.opacity = "0.15";
            element.style.transition = "all 0.3s ease";
            
            compteurMasques++;
            historiqueBlocages.push({ texte: texte, raison: raison });

            const bandeau = document.getElementById('ia-bandeau-statut');
            if (bandeau) {
                const typeMode = modeIAOperationnel ? "Protection IA" : "Mode hybride";
                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.14 actif : ${typeMode} (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`;
            }
        }

        // Fenêtre d'historique au clic sur le bandeau vert
        window.afficherResumeFiltre = function() {
            if (historiqueBlocages.length === 0) {
                alert("📝 Aucun élément n'a encore été masqué par le filtre.");
                return;
            }
            let texteResume = `📝 RÉSUMÉ DES ${compteurMasques} ÉLÉMENTS MASQUÉS :\n\n`;
            historiqueBlocages.forEach((item, index) => {
                texteResume += `${index + 1}) [${item.raison}] "${item.texte.substring(0, 60)}..."\n\n`;
            });
            alert(texteResume);
        };
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
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important; cursor:pointer;";
        
        // Au clic sur le bandeau vert, on déclenche l'affichage du résumé
        if (couleurFond === "#28a745") {
            bandeau.onclick = (e) => {
                e.stopPropagation();
                window.afficherResumeFiltre();
            };
        }
    }
})();
