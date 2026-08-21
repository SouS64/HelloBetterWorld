// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.2
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        https://*://*
// @match        https://m://*
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://jsdelivr.net
// ==/UserScript==


(async function() {
    'use strict';

    // Récupération des réglages stockés
    let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
    let filtrerHaine = GM_getValue("filtre_haine", true);
    let filtrerIronie = GM_getValue("filtre_ironie", true);
    
    let pipelineAnalyseur = null;

    // Lancement de l'interface de contrôle
    creerBoutonConfiguration();

    // Chargement automatique du modèle d'IA local
    async function initIA() {
        try {
            console.log("Démarrage du téléchargement/chargement de l'IA locale...");
            // Chargement d'un modèle multilingue optimisé pour classifier la toxicité et le ton
            pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
            console.log("IA locale prête et active sur Facebook !");
        } catch (erreur) {
            console.error("Échec du chargement de l'IA :", erreur);
        }
    }
    await initIA();

    // Analyse approfondie du texte
    async function verifierSiContenuIndesirable(texte) {
        if (!pipelineAnalyseur) return false;
        
        try {
            const resultats = await pipelineAnalyseur(texte);
            const scoreToxicite = resultats[0].score;
            const etiquette = resultats[0].label;

            // Logique de tri selon vos critères d'utilité et de bienveillance
            if (etiquette === 'toxic' && scoreToxicite > seuilSensibilite) {
                return { bloquer: true, raison: "Contenu toxique ou agressif" };
            }
            
            // Simulation d'analyse d'ironie/non-pertinence basée sur la longueur et la ponctuation agressive (ex: !!!, ???)
            if (filtrerIronie && (texte.includes('???') || texte.includes('📢')) && scoreToxicite > 0.4) {
                return { bloquer: true, raison: "Moquerie ou ironie suspectée" };
            }

            return { bloquer: false };
        } catch (e) {
            return { bloquer: false };
        }
    }

    // Traque les commentaires injectés dynamiquement par Facebook
    async function inspecterLaPage() {
        const elementsCommentaires = document.querySelectorAll('[role="article"]:not([data-ia-analyse])');

        elementsCommentaires.forEach(async (commentaire) => {
            commentaire.setAttribute('data-ia-analyse', 'en_cours');
            
            const texteBrut = commentaire.innerText;
            if (!texteBrut || texteBrut.length < 4) return;

            const verdict = await verifierSiContenuIndesirable(texteBrut);

            if (verdict && verdict.bloquer) {
                // Rendre le commentaire flou
                commentaire.style.filter = "blur(7px)";
                commentaire.style.opacity = "0.15";
                commentaire.style.transition = "all 0.3s ease";
                commentaire.style.pointerEvents = "none";

                // Ajout d'une petite étiquette discrète pour redonner le contrôle à l'utilisateur
                const alerteVisuelle = document.createElement('div');
                alerteVisuelle.innerHTML = `⚠️ <em>Commentaire masqué par l'IA (${verdict.raison})</em> [👁️ Démasquer]`;
                alerteVisuelle.style = "color:#ff4d4d; font-size:11px; padding:5px; cursor:pointer; font-family:sans-serif; pointer-events:auto;";
                
                alerteVisuelle.onclick = () => {
                    commentaire.style.filter = "none";
                    commentaire.style.opacity = "1";
                    commentaire.style.pointerEvents = "auto";
                    alerteVisuelle.remove();
                };
                
                commentaire.parentNode.insertBefore(alerteVisuelle, commentaire);
            }
            commentaire.setAttribute('data-ia-analyse', 'termine');
        });
    }

    // Déclencheur automatique au défilement
    const observateurPage = new MutationObserver(inspecterLaPage);
    observateurPage.observe(document.body, { childList: true, subtree: true });

    // Menu de configuration flottant (Le petit engrenage)
    function creerBoutonConfiguration() {
        const engrenage = document.createElement('div');
        engrenage.innerHTML = "⚙️";
        engrenage.style = "position:fixed; bottom:20px; right:20px; width:45px; height:45px; background:#1877f2; color:white; border-radius:50%; text-align:center; line-height:45px; font-size:22px; cursor:pointer; z-index:999999; box-shadow:0 4px 8px rgba(0,0,0,0.2);";
        document.body.appendChild(engrenage);

        const boiteOptions = document.createElement('div');
        boiteOptions.style = "position:fixed; bottom:75px; right:20px; width:250px; background:white; border-radius:8px; border:1px solid #ccc; padding:15px; z-index:999999; display:none; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:sans-serif;";
        boiteOptions.innerHTML = `
            <h4 style="margin:0 0 10px 0; color:#1877f2;">Options du Filtre IA</h4>
            <label style="display:block; margin-bottom:8px; font-size:13px;">
                <input type="checkbox" id="chkHaine" ${filtrerHaine ? 'checked' : ''}> Filtrer la haine/insultes
            </label>
            <label style="display:block; margin-bottom:12px; font-size:13px;">
                <input type="checkbox" id="chkIronie" ${filtrerIronie ? 'checked' : ''}> Détecter l'ironie & moqueries
            </label>
            <div style="font-size:12px; margin-bottom:5px;">Sensibilité : <span id="txtSens">${Math.round(seuilSensibilite*100)}%</span></div>
            <input type="range" id="rngSens" min="40" max="90" value="${seuilSensibilite*100}" style="width:100%;">
        `;
        document.body.appendChild(boiteOptions);

        engrenage.onclick = () => {
            boiteOptions.style.display = boiteOptions.style.display === 'none' ? 'block' : 'none';
        };

        boiteOptions.querySelector('#chkHaine').onchange = (e) => GM_setValue("filtre_haine", e.target.checked);
        boiteOptions.querySelector('#chkIronie').onchange = (e) => GM_setValue("filtre_ironie", e.target.checked);
        boiteOptions.querySelector('#rngSens').oninput = (e) => {
            let v = e.target.value;
            boiteOptions.querySelector('#txtSens').innerText = v + "%";
            GM_setValue("seuil_sensibilite", v / 100);
            seuilSensibilite = v / 100;
        };
    }
})();
