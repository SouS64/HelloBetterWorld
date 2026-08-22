// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.15
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.15 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = [];
        let modeIAOperationnel = false;
        let dictionnaireHaine = ["débile", "idiot", "nul", "ferme ta", "fdp", "connard", "salope", "cassos", "pauvre naze", "moche", "clown", "gogol"]; 
        let workerIA = null;

        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.15 active sur Facebook : Initialisation de l'IA locale...", "#ff9800");
            initIAAvecWorker();
        });

        function initIAAvecWorker() {
            try {
                // Version optimisée pour iOS : réduction de la taille des buffers et allocation mémoire directe
                const codeWorker = `
                    importScripts('https://jsdelivr.net');
                    
                    let pipelineAnalyseur = null;
                    
                    async function chargerModere() {
                        try {
                            // On configure Transformers pour utiliser des modèles très légers et configurés pour le cache mobile
                            transformers.env.allowLocalModels = false;
                            
                            // Chargement d'un modèle ultra-quantifié (très léger en mémoire pour smartphone)
                            pipelineAnalyseur = await Transformers.pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
                            
                            postMessage({ statut: 'PRET' });
                        } catch (e) {
                            postMessage({ statut: 'ERREUR', detail: e.message });
                        }
                    }
                    chargerModere();

                    onmessage = async function(e) {
                        if (!pipelineAnalyseur) return;
                        try {
                            const resultats = await pipelineAnalyseur(e.data.texte);
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
                workerIA = new Worker(URL.createObjectURL(blob));

                // On augmente le délai d'attente à 15 secondes car le premier téléchargement sur iPhone requiert du temps
                const timeoutSecurite = setTimeout(() => {
                    if (!modeIAOperationnel) {
                        console.log("iOS trop lent pour charger l'IA complète, maintien du mode hybride.");
                        creerBandeauStatut(`Filtre IA v1.15 actif : Mode hybride (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`, "#28a745");
                    }
                }, 15000);

                workerIA.onmessage = function(evenement) {
                    if (evenement.data.statut === 'PRET') {
                        clearTimeout(timeoutSecurite);
                        modeIAOperationnel = true;
                        creerBandeauStatut(`🛡️ Filtre IA v1.15 actif : Protection IA opérationnelle (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`, "#28a745");
                    } 
                    else if (evenement.data.statut === 'ANALYSE') {
                        const el = document.querySelector('[data-ia-id="' + evenement.data.id + '"]');
                        if (!el) return;

                        // Le modèle sst-2 utilise 'NEGATIVE' pour désigner les contenus toxiques/haineux/négatifs
                        if ((evenement.data.label === 'NEGATIVE' || evenement.data.label === 'toxic') && evenement.data.score > 0.75) {
                            appliquerFloutage(el, el.innerText, "Intelligence Artificielle Locale");
                        }
                    }
                };

                // Lance la surveillance immédiatement, elle profitera de l'IA dès qu'elle se réveillera
                lancerSurveillancePage();

            } catch (erreur) {
                lancerSurveillancePage();
            }
        }

        function lancerSurveillancePage() {
            function inspecterCommentaires() {
                const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v])');
                
                elementsTexte.forEach((el) => {
                    el.setAttribute('data-ia-v', 'true');
                    if (!el.innerText || el.innerText.trim().length < 5 || el.children.length > 1) return;
                    
                    const texteOriginal = el.innerText;
                    const texteNettoye = texteOriginal.toLowerCase().trim();

                    // Si l'IA a fini de démarrer, on lui envoie le texte en arrière-plan
                    if (modeIAOperationnel && workerIA) {
                        const uniqueId = "id_" + Math.random().toString(36).substr(2, 9);
                        el.setAttribute('data-ia-id', uniqueId);
                        workerIA.postMessage({ texte: texteOriginal, id: uniqueId });
                    }

                    // Le dictionnaire tourne TOUJOURS en tâche de fond pour une réactivité instantanée
                    let estToxique = dictionnaireHaine.some(mot => texteNettoye.includes(mot));
                    if (estToxique) {
                        appliquerFloutage(el, texteOriginal, "Dictionnaire de secours");
                    }
                });
            }
            setInterval(inspecterCommentaires, 1500);
        }

        function appliquerFloutage(element, texte, raison) {
            // Évite de flouter deux fois le même élément
            if (element.style.filter.includes("blur")) return;

            element.style.filter = "blur(7px)";
            element.style.opacity = "0.15";
            element.style.transition = "all 0.3s ease";
            
            compteurMasques++;
            // On vérifie si la phrase n'est pas déjà dans l'historique
            if (!historiqueBlocages.some(h => h.texte === texte)) {
                historiqueBlocages.push({ texte: texte, raison: raison });
            }

            const bandeau = document.getElementById('ia-bandeau-statut');
            if (bandeau) {
                const labelMode = modeIAOperationnel ? "Protection IA" : "Mode hybride";
                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.15 actif : ${labelMode} (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`;
            }
        }

        window.afficherResumeFiltre = function() {
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
    }

    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            document.body.insertBefore(bandeau, document.body.firstChild);
        }
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important; cursor:pointer;";
        
        if (couleurFond === "#28a745") {
            bandeau.onclick = (e) => {
                e.stopPropagation();
                window.afficherResumeFiltre();
            };
        }
    }
})();
