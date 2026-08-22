// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.17
// @description  Filtre intelligent local avec panneau de configuration pour ajouter vos critères sur Facebook.
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
        creerBandeauStatut("✅ Ça fonctionne ! L'extension v1.17 est active sur votre page d'accueil.");
        return; 
    }

    // 2. DÉTECTION PAGE FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        let historiqueBlocages = [];
        
        // Charger la liste personnalisée de l'utilisateur, ou mettre une liste par défaut si vide
        let listeMotsStockes = GM_getValue("mes_criteres_ia", "débile, idiot, nul, fdp, connard, salope, clown, gogol");
        let dictionnaireHaine = rafraichirDictionnaire(listeMotsStockes);

        window.addEventListener('load', () => {
            creerBandeauStatut(`🛡️ Filtre IA v1.17 : Actif (💬 ${compteurMasques} masqués) <span id="btn-ouvrir-config" style="text-decoration:underline;margin-left:8px;color:#ffeb3b;">[Régler ⚙️]</span>`, "#28a745");
            creerPanneauConfigurationVisuel();
            lancerSurveillancePage();
        });

        function rafraichirDictionnaire(texteBrut) {
            return texteBrut.split(',').map(mot => mot.trim().toLowerCase()).filter(mot => mot.length > 0);
        }

        function lancerSurveillancePage() {
            function inspecterCommentaires() {
                const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div[data-sigil="comment-body"]:not([data-ia-v])');
                
                elementsTexte.forEach(async (el) => {
                    el.setAttribute('data-ia-v', 'true');
                    if (!el.innerText || el.innerText.trim().length < 3 || el.children.length > 1) return;
                    
                    const texteOriginal = el.innerText;
                    const texteNettoye = texteOriginal.toLowerCase().trim();

                    // Traitement par le dictionnaire personnalisé en temps réel
                    let estToxique = dictionnaireHaine.some(mot => texteNettoye.includes(mot));
                    if (estToxique) {
                        appliquerFloutage(el, texteOriginal, "Critère personnalisé");
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
                const zoneBouton = `<span id="btn-ouvrir-config" style="text-decoration:underline;margin-left:8px;color:#ffeb3b;">[Régler ⚙️]</span>`;
                bandeau.innerHTML = `⚙️ 🛡️ Filtre IA v1.17 : Actif (💬 ${compteurMasques} masqués) ${zoneBouton}`;
                
                // Ré-attacher l'événement au bouton après modification du texte
                document.getElementById('btn-ouvrir-config').onclick = (e) => {
                    e.stopPropagation();
                    ouvrirFermerPanneau();
                };
            }
        }

        // CRÉATION DE L'INTERFACE DE CONFIGURATION SUR L'ÉCRAN
        function creerPanneauConfigurationVisuel() {
            if (document.getElementById('ia-panneau-config')) return;

            const panneau = document.createElement('div');
            panneau.id = 'ia-panneau-config';
            panneau.style = "display:none; position:fixed; top:70px; left:15px; right:15px; background:white; border-radius:12px; border:2px solid #1877f2; padding:15px; z-index:99999999; box-shadow:0 10px 25px rgba(0,0,0,0.3); font-family:sans-serif; color:#333; box-sizing:border-box;";
            
            panneau.innerHTML = `
                <h3 style="margin-top:0;color:#1877f2;font-size:16px;display:flex;justify-content:between;align-items:center;">
                    🛠️ Vos critères de blocage
                </h3>
                <p style="font-size:11px;color:#666;margin-bottom:10px;">Séparez vos mots ou expressions par des virgules (ex: débile, idiot, pub) :</p>
                <textarea id="ia-txt-mots" style="width:100%; height:80px; padding:8px; border-radius:6px; border:1px solid #ccc; font-family:sans-serif; font-size:13px; box-sizing:border-box; resize:none;">${listeMotsStockes}</textarea>
                <div style="margin-top:12px; display:flex; gap:10px;">
                    <button id="ia-btn-sauver" style="flex:1; padding:10px; background:#28a745; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px;">💾 Sauvegarder</button>
                    <button id="ia-btn-voir-historique" style="flex:1; padding:10px; background:#6c757d; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px;">📝 Voir l'historique</button>
                </div>
            `;
            document.body.appendChild(panneau);

            // Actions des boutons
            document.getElementById('ia-btn-sauver').onclick = () => {
                const nouveauTexte = document.getElementById('ia-txt-mots').value;
                GM_setValue("mes_criteres_ia", nouveauTexte); // Sauvegarde locale définitive
                listeMotsStockes = nouveauTexte;
                dictionnaireHaine = rafraichirDictionnaire(nouveauTexte); // Applique immédiatement
                alert("✅ Vos critères ont été enregistrés avec succès ! La page va s'actualiser.");
                window.location.reload();
            };

            document.getElementById('ia-btn-voir-historique').onclick = () => {
                if (historiqueBlocages.length === 0) {
                    alert("📝 Aucun élément n'a encore été masqué.");
                    return;
                }
                let résumé = `📝 ÉLÉMENTS MASQUÉS DURANT CETTE SESSION :\n\n`;
                historiqueBlocages.forEach((item, index) => {
                    résumé += `${index + 1}) "${item.texte.substring(0, 60)}..."\n\n`;
                });
                alert(résumé);
            };
        }

        function ouvrirFermerPanneau() {
            const p = document.getElementById('ia-panneau-config');
            if (p) {
                p.style.display = p.style.display === 'none' ? 'block' : 'none';
            }
        }
    }

    function creerBandeauStatut(message, couleurFond = "#1877f2") {
        let bandeau = document.getElementById('ia-bandeau-statut');
        if (!bandeau) {
            bandeau = document.createElement('div');
            bandeau.id = 'ia-bandeau-statut';
            document.body.insertBefore(bandeau, document.body.firstChild);
        }
        bandeau.innerHTML = "⚙️ " + message;
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:" + couleurFond + " !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important;";
        
        // Active le bouton au chargement initial
        const btn = document.getElementById('btn-ouvrir-config');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                const p = document.getElementById('ia-panneau-config');
                if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
            };
        }
    }
})();
