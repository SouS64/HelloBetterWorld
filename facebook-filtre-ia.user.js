// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.16
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.16 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = [];
        let sessionIA = null;
        let dictionnaireHaine = ["débile", "idiot", "nul", "ferme ta", "fdp", "connard", "salope", "cassos", "pauvre naze", "moche", "clown", "gogol"]; 

        window.addEventListener('load', () => {
            creerBandeauStatut("⏳ Extension v1.16 active sur Facebook : Initialisation de l'IA matérielle...", "#ff9800");
            initIANative();
        });

        async function initIANative() {
            try {
                // On vérifie si le système iOS / Safari propose l'accès à l'IA embarquée de l'iPhone
                if (window.ai && window.ai.languageModel) {
                    const capabilities = await window.ai.languageModel.capabilities();
                    
                    if (capabilities.available !== "no") {
                        // Initialisation du modèle interne avec un prompt système de modération
                        sessionIA = await window.ai.languageModel.create({
                            systemPrompt: "Tu es un modérateur de commentaires Facebook. Analyse le texte fourni. Réponds uniquement par le mot TOXIC s'il contient de la haine, de l'insulte ou de la moquerie agressive, sinon réponds par CLEAN. Ne fais aucune autre phrase."
                        });
                        
                        creerBandeauStatut(`🛡️ Filtre IA v1.16 actif : Protection par l'IA de l'iPhone (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`, "#28a745");
                        lancerSurveillancePage(true);
                        return;
                    }
                }
                
                // Si l'iPhone n'a pas d'IA active ou disponible dans ses réglages, bascule transparente sur le dictionnaire
                creerBandeauStatut(`Filtre IA v1.16 actif : Mode hybride (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`, "#28a745");
                lancerSurveillancePage(false);
                
            } catch (erreur) {
                console.error("Échec IA native :", erreur);
                creerBandeauStatut(`Filtre IA v1.16 actif : Mode hybride de secours (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`, "#28a745");
                lancerSurveillancePage(false);
            }
        }

        function lancerSurveillancePage(iaDisponible) {
            function inspecterCommentaires() {
                const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v])');
                
                elementsTexte.forEach(async (el) => {
                    el.setAttribute('data-ia-v', 'true');
                    if (!el.innerText || el.innerText.trim().length < 5 || el.children.length > 1) return;
                    
                    const texteOriginal = el.innerText;
                    const texteNettoye = texteOriginal.toLowerCase().trim();

                    // Traitement par le dictionnaire de secours (instantané)
                    let estToxiqueParMots = dictionnaireHaine.some(mot => texteNettoye.includes(mot));
                    if (estToxiqueParMots) {
                        appliquerFloutage(el, texteOriginal, "Dictionnaire de secours");
                        return;
                    }

                    // Traitement par l'IA native si elle est réveillée
                    if (iaDisponible && sessionIA) {
                        try {
                            const reponseIA = await sessionIA.prompt(texteOriginal);
                            if (reponseIA.toUpperCase().includes("TOXIC")) {
                                appliquerFloutage(el, texteOriginal, "IA Puce Neuronale iPhone");
                            }
                        } catch(e) {
                            // En cas de micro-coupure de la session IA, le script continue sans planter
                        }
                    }
                });
            }
            setInterval(inspecterCommentaires, 1500);
        }

        function appliquerFloutage(element, texte, raison) {
            if (element.style.filter.includes("blur")) return;

            element.style.filter = "blur(7px)";
            element.style.opacity = "0.15";
            element.style.transition = "all 0.3s ease";
            
            compteurMasques++;
            if (!historiqueBlocages.some(h => h.texte === texte)) {
                historiqueBlocages.push({ texte: texte, raison: raison });
            }

            const bandeau = document.getElementById('ia-bandeau-statut');
            if (bandeau) {
                const labelMode = sessionIA ? "Protection IA" : "Mode hybride";
                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.16 actif : ${labelMode} (💬 ${compteurMasques} masqués) <span style="text-decoration:underline;margin-left:5px;font-size:11px;">[Voir résumé]</span>`;
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
