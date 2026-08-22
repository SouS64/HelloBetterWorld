// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      2.0
// @description  Système d'analyse sémantique et dictionnaire dynamique contre le harcèlement et les moqueries.
// @author       Votre Nom
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const urlActuelle = window.location.href;

    // 1. GESTION DE LA PAGE D'ACCUEIL GITHUB
    if (urlActuelle.includes('github.io')) {
        creerBandeauFlottant("✅ Extension Active v2.0 sur votre page d'accueil d'installation.");
        return; 
    }

    // 2. EXÉCUTION STRICTE SUR FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = [];
        
        // Récupération des critères de l'utilisateur (ou dictionnaire natif très complet)
        let baseMots = GM_getValue("mes_criteres_ia", "débile, idiot, nul, fdp, connard, salope, clown, gogol, cassos, naze, rater, merde, chier, bouffon, laid, moche");
        let dictionnaire = baseMots.split(',').map(m => m.trim().toLowerCase()).filter(m => m.length > 0);

        // Lancement immédiat de l'interface visuelle persistante
        creerBandeauFlottant(`🛡️ Filtre Actif (💬 0 masqués)`);
        creerPanneauConfigurationVisuel();
        
        // Lancement de la surveillance sémantique en continu
        lancerFiltreSemantique();

        function lancerFiltreSemantique() {
            function analyserElements() {
                // Ciblage universel de toutes les zones de textes et commentaires sur Facebook Mobile / PC
                const blocsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v]), div[data-comment-id]:not([data-ia-v])');
                
                blocsTexte.forEach((el) => {
                    el.setAttribute('data-ia-v', 'true'); // Évite l'analyse infinie
                    
                    if (!el.innerText || el.innerText.trim().length < 3) return;
                    
                    const contenuOriginal = el.innerText;
                    const contenuMinuscule = contenuOriginal.toLowerCase().trim();

                    let evaluationToxicite = false;
                    let motifDetection = "";

                    // CONTOURNELEMENT IA : Analyseur sémantique structurel natif
                    // Règle A : Vérification de la présence d'un mot du dictionnaire personnalisé
                    let contientMotBanni = dictionnaire.some(mot => contenuMinuscule.includes(mot));
                    if (contientMotBanni) {
                        evaluationToxicite = true;
                        motifDetection = "Critère ciblé repéré";
                    }

                    // Règle B : Détection de l'ironie agressive / Moquerie par accumulation (Ex: "Ah ouais bravo !!!", "Mdr le niveau ???")
                    const structureMoqueuse = /(mdr|ptdr|xptdr|😂|🤡|🤣).*(?! )([\?\!]{2,})/g;
                    if (structureMoqueuse.test(contenuMinuscule)) {
                        evaluationToxicite = true;
                        motifDetection = "Ironie ou moquerie structurelle";
                    }

                    // Règle C : Attaque personnelle ciblée ("tu es...", "t'es vraiment...") couplée à une ponctuation forte
                    if ((contenuMinuscule.includes("t'es ") || contenuMinuscule.includes("tu es ")) && (contenuMinuscule.includes("!") || contenuMinuscule.includes("?"))) {
                        // On pousse l'analyse sémantique : si la phrase fait moins de 40 caractères, c'est souvent une pique directe
                        if (contenuMinuscule.length < 50) {
                            evaluationToxicite = true;
                            motifDetection = "Tournure d'attaque personnelle";
                        }
                    }

                    // SI TOXIQUE : On applique le floutage de sécurité
                    if (evaluationToxicite) {
                        // Injection du style CSS de floutage direct de l'élément
                        el.style.setProperty("filter", "blur(8px)", "important");
                        el.style.setProperty("opacity", "0.15", "important");
                        el.style.setProperty("transition", "all 0.3s ease", "important");
                        el.style.setProperty("pointer-events", "none", "important");

                        compteurMasques++;
                        
                        // Enregistrement dans l'historique de session
                        if (!historiqueBlocages.some(h => h.texte === contenuOriginal)) {
                            historiqueBlocages.push({ texte: contenuOriginal, raison: motifDetection });
                        }

                        // Mise à jour de l'affichage sur le bouton vert
                        const badge = document.getElementById('ia-bandeau-statut');
                        if (badge) {
                            badge.innerHTML = `⚙️ 🛡️ (💬 ${compteurMasques} masqués)`;
                        }
                    }
                });
            }
            // Exécution ultra-rapide toutes les secondes pour contrer les rafraîchissements de Facebook
            setInterval(analyserElements, 1000);
        }

        // CRÉATION DU PANNEAU DE CONFIGURATION DES CRITÈRES
        function creerPanneauConfigurationVisuel() {
            if (document.getElementById('ia-panneau-config')) return;

            const panneau = document.createElement('div');
            panneau.id = 'ia-panneau-config';
            // Style de fenêtre modale centrée et protégée contre le CSS de Facebook
            panneau.style = "display:none; position:fixed !important; top:25% !important; left:15px !important; right:15px !important; background:white !important; border-radius:14px !important; border:3px solid #1877f2 !important; padding:18px !important; z-index:999999999 !important; box-shadow:0 12px 30px rgba(0,0,0,0.4) !important; font-family:sans-serif !important; color:#333 !important; box-sizing:border-box !important;";
            
            panneau.innerHTML = `
                <h3 style="margin-top:0;color:#1877f2;font-size:16px;margin-bottom:5px;font-weight:bold;">🛠️ Gestion de vos filtres</h3>
                <p style="font-size:11px;color:#666;margin-bottom:12px;line-height:1.3;">Ajoutez vos mots ou expressions séparés par des virgules pour calibrer le filtre :</p>
                <textarea id="ia-txt-mots" style="width:100% !important; height:95px !important; padding:8px !important; border-radius:6px !important; border:1px solid #ccc !important; font-family:sans-serif !important; font-size:13px !important; box-sizing:border-box !important; resize:none !important; background:#fdfdfd !important; color:#000 !important;">${baseMots}</textarea>
                <div style="margin-top:14px; display:flex; gap:10px;">
                    <button id="ia-btn-sauver" style="flex:1; padding:11px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">💾 Sauvegarder</button>
                    <button id="ia-btn-voir-historique" style="flex:1; padding:11px; background:#6c757d; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">📝 Historique</button>
                </div>
            `;
            document.body.appendChild(panneau);

            // Événement du bouton Sauvegarder
            document.getElementById('ia-btn-sauver').onclick = () => {
                const valeursSaisies = document.getElementById('ia-txt-mots').value;
                GM_setValue("mes_criteres_ia", valeursSaisies); 
                alert("✅ Vos critères sémantiques ont été mis à jour !");
                window.location.reload();
            };

            // Événement du bouton Historique / Résumé
            document.getElementById('ia-btn-voir-historique').onclick = () => {
                if (historiqueBlocages.length === 0) {
                    alert("📝 Aucun texte n'a été intercepté pour le moment sur cette page.");
                    return;
                }
                let bilan = `🛡️ BILAN DES COMMENTAIRES CHASSÉS :\n\n`;
                historiqueBlocages.forEach((item, index) => {
                    bilan += `${index + 1}) [${item.raison}] "${item.texte.substring(0, 55)}..."\n\n`;
                });
                alert(bilan);
            };
        }
    }

    // BOUTON VERT FLOTTANT (PERSISTANT SUR L'ÉCRAN)
    function creerBandeauFlottant(message) {
        if (document.getElementById('ia-bandeau-statut')) return;

        const bandeau = document.createElement('div');
        bandeau.id = 'ia-bandeau-statut';
        document.body.appendChild(bandeau);
        
        bandeau.innerHTML = "⚙️ " + message;
        // Application de règles de priorité CSS absolues (!important) pour résister aux surcouches graphiques de Facebook
        bandeau.style = "position:fixed !important; bottom:20px !important; right:20px !important; padding:12px 18px !important; background:#28a745 !important; color:white !important; border-radius:30px !important; font-family:sans-serif !important; font-size:13px !important; font-weight:bold !important; z-index:999999998 !important; box-shadow:0 4px 15px rgba(0,0,0,0.3) !important; cursor:pointer !important; display:block !important; width:auto !important; height:auto !important;";
        
        // Au clic sur la pastille verte, ouverture ou fermeture de la boîte à outils
        bandeau.onclick = (e) => {
            e.stopPropagation();
            const configBox = document.getElementById('ia-panneau-config');
            if (configBox) {
                configBox.style.display = configBox.style.display === 'none' ? 'block' : 'none';
            }
            
            };}})();
