// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      2.1
// @description  Système sémantique avec injection forcée CSP et dictionnaire dynamique persistant pour Facebook mobile.
// @author       Votre Nom
// @match        *://*/*
// @inject-into  content
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const urlActuelle = window.location.href;

    // 1. DÉTECTION PAGE GITHUB
    if (urlActuelle.includes('github.io')) {
        // Attendre que l'écran soit disponible sur la page d'index
        setTimeout(() => creerBandeauFlottant("✅ Extension Active v2.1 sur votre page d'accueil."), 800);
        return; 
    }

    // 2. EXÉCUTION SUR FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = [];
        
        // Configuration de la base de critères personnalisés de l'utilisateur
        let baseMots = GM_getValue("mes_criteres_ia", "débile, idiot, nul, fdp, connard, salope, clown, gogol, cassos, naze, merde, laid, moche");
        let dictionnaire = baseMots.split(',').map(m => m.trim().toLowerCase()).filter(m => m.length > 0);

        // Injection visuelle forcée dès que l'écran répond
        const intervalleChargement = setInterval(() => {
            if (document.body) {
                clearInterval(intervalleChargement);
                creerBandeauFlottant(`🛡️ Filtre Actif (💬 0 masqués)`);
                creerPanneauConfigurationVisuel();
                lancerFiltreSemantique();
            }
        }, 200);

        function lancerFiltreSemantique() {
            function analyserElements() {
                // Analyse universelle des nœuds textuels
                const blocsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v]), div[data-comment-id]:not([data-ia-v])');
                
                blocsTexte.forEach((el) => {
                    el.setAttribute('data-ia-v', 'true');
                    if (!el.innerText || el.innerText.trim().length < 3) return;
                    
                    const contenuOriginal = el.innerText;
                    const contenuMinuscule = contenuOriginal.toLowerCase().trim();

                    let evaluationToxicite = false;
                    let motifDetection = "";

                    // CONTOURNEMENT IA : Analyseur de structures sémantiques et de ton
                    let contientMotBanni = dictionnaire.some(mot => contenuMinuscule.includes(mot));
                    if (contientMotBanni) {
                        evaluationToxicite = true;
                        motifDetection = "Critère ciblé repéré";
                    }

                    // Détection des structures d'ironie ou moqueries répétitives (Ex: "Ah bravo !!!", "Mdr le niveau ???")
                    const structureMoqueuse = /(mdr|ptdr|😂|🤡|🤣).*(?! )([\?\!]{2,})/g;
                    if (structureMoqueuse.test(contenuMinuscule)) {
                        evaluationToxicite = true;
                        motifDetection = "Ironie ou moquerie sémantique";
                    }

                    // Détection des attaques personnelles courtes ciblées ("tu es...", "t'es...") avec ponctuation agressive
                    if ((contenuMinuscule.includes("t'es ") || contenuMinuscule.includes("tu es ")) && (contenuMinuscule.includes("!") || contenuMinuscule.includes("?"))) {
                        if (contenuMinuscule.length < 50) {
                            evaluationToxicite = true;
                            motifDetection = "Tournure d'attaque personnelle";
                        }
                    }

                    // APPLICATION DU FLOUTAGE
                    if (evaluationToxicite) {
                        el.style.setProperty("filter", "blur(8px)", "important");
                        el.style.setProperty("opacity", "0.15", "important");
                        el.style.setProperty("transition", "all 0.3s ease", "important");
                        el.style.setProperty("pointer-events", "none", "important");

                        compteurMasques++;
                        
                        if (!historiqueBlocages.some(h => h.texte === contenuOriginal)) {
                            historiqueBlocages.push({ texte: contenuOriginal, raison: motifDetection });
                        }

                        const badge = document.getElementById('ia-bandeau-statut');
                        if (badge) {
                            badge.innerHTML = `⚙️ 🛡️ (💬 ${compteurMasques} masqués)`;
                        }
                    }
                });
            }
            setInterval(analyserElements, 1000);
        }

        function creerPanneauConfigurationVisuel() {
            if (document.getElementById('ia-panneau-config')) return;

            const panneau = document.createElement('div');
            panneau.id = 'ia-panneau-config';
            panneau.style = "display:none; position:fixed !important; top:25% !important; left:15px !important; right:15px !important; background:white !important; border-radius:14px !important; border:3px solid #1877f2 !important; padding:18px !important; z-index:999999999 !important; box-shadow:0 12px 30px rgba(0,0,0,0.4) !important; font-family:sans-serif !important; color:#333 !important; box-sizing:border-box !important;";
            
            panneau.innerHTML = `
                <h3 style="margin-top:0;color:#1877f2;font-size:16px;margin-bottom:5px;font-weight:bold;">🛠️ Gestion de vos filtres</h3>
                <p style="font-size:11px;color:#666;margin-bottom:12px;line-height:1.3;">Ajoutez vos critères séparés par des virgules :</p>
                <textarea id="ia-txt-mots" style="width:100% !important; height:95px !important; padding:8px !important; border-radius:6px !important; border:1px solid #ccc !important; font-family:sans-serif !important; font-size:13px !important; box-sizing:border-box !important; resize:none !important; background:#fdfdfd !important; color:#000 !important;">${baseMots}</textarea>
                <div style="margin-top:14px; display:flex; gap:10px;">
                    <button id="ia-btn-sauver" style="flex:1; padding:11px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">💾 Sauvegarder</button>
                    <button id="ia-btn-voir-historique" style="flex:1; padding:11px; background:#6c757d; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer;">📝 Historique</button>
                </div>
            `;
            document.body.appendChild(panneau);

            document.getElementById('ia-btn-sauver').onclick = () => {
                const valeursSaisies = document.getElementById('ia-txt-mots').value;
                GM_setValue("mes_criteres_ia", valeursSaisies); 
                alert("✅ Vos critères sémantiques ont été mis à jour !");
                window.location.reload();
            };

            document.getElementById('ia-btn-voir-historique').onclick = () => {
                if (historiqueBlocages.length === 0) {
                    alert("📝 Aucun texte intercepté pour le moment.");
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

    function creerBandeauFlottant(message) {
        if (document.getElementById('ia-bandeau-statut')) return;

        const bandeau = document.createElement('div');
        bandeau.id = 'ia-bandeau-statut';
        document.body.appendChild(bandeau);
        
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "position:fixed !important; bottom:20px !important; right:20px !important; padding:12px 18px !important; background:#28a745 !important; color:white !important; border-radius:30px !important; font-family:sans-serif !important; font-size:13px !important; font-weight:bold !important; z-index:999999998 !important; box-shadow:0 4px 15px rgba(0,0,0,0.3) !important; cursor:pointer !important; display:block !important; width:auto !important; height:auto !important;";
        
        bandeau.onclick = (e) => {
            e.stopPropagation();
            const configBox = document.getElementById('ia-panneau-config');
            if (configBox) {
                configBox.style.display = configBox.style.display === 'none' ? 'block' : 'none';
            }
        };
    }
})();
