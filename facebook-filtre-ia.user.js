// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      3.0
// @description  Filtre sémantique ultra-léger et robuste pour Facebook Mobile sur iOS.
// @author       Votre Nom
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const urlActuelle = window.location.href;

    // 1. SUR VOTRE PAGE D'ACCUEIL GITHUB
    if (urlActuelle.includes('github.io')) {
        alert("✅ Configuration v3.0 validée sur l'accueil !");
        return; 
    }

    // 2. SUR FACEBOOK
    if (urlActuelle.includes('facebook.com')) {
        
        let compteurMasques = 0;
        
        // On récupère vos mots, ou la liste par défaut si c'est vide
        let mesMots = GM_getValue("mes_mots_ios", "débile, idiot, nul, fdp, connard, salope, clown, gogol, moche");
        let dictionnaire = mesMots.split(',').map(m => m.trim().toLowerCase()).filter(m => m.length > 0);

        // On affiche le bandeau vert d'état (Exactement comme dans la version qui marchait !)
        let bandeau = document.createElement('div');
        bandeau.id = 'ia-bandeau-statut';
        document.body.insertBefore(bandeau, document.body.firstChild);
        bandeau.innerHTML = `⚙️ Filtre v3.0 : Actif (💬 0 masqués) [Modifier 📝]`;
        bandeau.style = "display:block !important; width:100% !important; padding:15px !important; background:#28a745 !important; color:white !important; text-align:center !important; font-family:sans-serif !important; font-size:14px !important; font-weight:bold !important; z-index:9999999 !important; box-shadow:0 2px 5px rgba(0,0,0,0.2) !important; box-sizing:border-box !important; cursor:pointer;";

        // Quand on clique sur le bandeau vert, l'iPhone ouvre une petite case pour changer les mots !
        bandeau.onclick = function() {
            let nouvelleSaisie = prompt("✍️ Modifiez vos critères de blocage (séparez les mots par des virgules) :", mesMots);
            if (nouvelleSaisie !== null) {
                GM_setValue("mes_mots_ios", nouvelleSaisie);
                alert("✅ Mots enregistrés ! La page va s'actualiser.");
                window.location.reload();
            }
        };

        // Le moteur de détection universel qui fonctionnait sur la v1.13
        function inspecterLeTexte() {
            const elementsTexte = document.querySelectorAll('span:not([data-ia-v]), p:not([data-ia-v]), div:not([data-ia-v])');
            
            elementsTexte.forEach((el) => {
                el.setAttribute('data-ia-v', 'true');

                if (!el.innerText || el.children.length > 2) return;
                
                const texte = el.innerText.toLowerCase().trim();
                if (texte.length < 2) return;

                // On vérifie si un mot du dictionnaire est dans le texte
                let doitMasquer = dictionnaire.some(mot => texte.includes(mot));

                if (doitMasquer) {
                    // Floutage immédiat
                    el.style.setProperty("filter", "blur(8px)", "important");
                    el.style.setProperty("opacity", "0.15", "important");
                    
                    compteurMasques++;
                    bandeau.innerHTML = `⚙️ Filtre v3.0 : Actif (💬 ${compteurMasques} masqués) [Modifier 📝]`;
                }
            });
        }

        // Lance l'analyse toutes les 1,5 seconde
        setInterval(inspecterLeTexte, 1500);
    }
})();
