// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.3
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        https://*://*
// @match        https://m://*
// @connect      cdn.jsdelivr.net
// @connect      huggingface.co
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://jsdelivr.net
// ==/UserScript==

(async function() {
    'use strict';

    let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
    let filtrerHaine = GM_getValue("filtre_haine", true);
    let filtrerIronie = GM_getValue("filtre_ironie", true);
    let pipelineAnalyseur = null;

    // FIX IOS : On affiche l'engrenage immédiatement sans attendre l'IA !
    creerBoutonConfiguration();

    async function initIA() {
        try {
            console.log("Démarrage de l'IA locale...");
            pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
            console.log("IA locale prête !");
            // Change la couleur de l'engrenage en vert pour indiquer que l'IA est chargée
            const engrenage = document.getElementById('ia-engrenage-flottant');
            if (engrenage) engrenage.style.background = "#28a745";
        } catch (erreur) {
            console.error("Échec IA :", erreur);
            const engrenage = document.getElementById('ia-engrenage-flottant');
            if (engrenage) engrenage.style.background = "#dc3545"; // Rouge si erreur
        }
    }
    await initIA();

    async function verifierSiContenuIndesirable(texte) {
        if (!pipelineAnalyseur) return false;
        try {
            const resultats = await pipelineAnalyseur(texte);
            if (resultats.label === 'toxic' && resultats.score > seuilSensibilite) {
                return { bloquer: true, raison: "Contenu toxique" };
            }
            return { bloquer: false };
        } catch (e) { return { bloquer: false }; }
    }

    async function inspecterLaPage() {
        const elements = document.querySelectorAll('[role="article"]:not([data-ia-analyse])');
        elements.forEach(async (com) => {
            com.setAttribute('data-ia-analyse', 'en_cours');
            const texte = com.innerText;
            if (!texte || texte.length < 4) return;
            const verdict = await verifierSiContenuIndesirable(texte);
            if (verdict && verdict.bloquer) {
                com.style.filter = "blur(7px)";
                com.style.opacity = "0.15";
            }
            com.setAttribute('data-ia-analyse', 'termine');
        });
    }

    const observateurPage = new MutationObserver(inspecterLaPage);
    observateurPage.observe(document.body, { childList: true, subtree: true });

    function creerBoutonConfiguration() {
        if (document.getElementById('ia-engrenage-flottant')) return;
        
        const engrenage = document.createElement('div');
        engrenage.id = 'ia-engrenage-flottant';
        engrenage.innerHTML = "⚙️";
        // Couleur orange par défaut (signifie : en cours de chargement)
        engrenage.style = "position:fixed; bottom:20px; right:20px; width:45px; height:45px; background:#ff9800; color:white; border-radius:50%; text-align:center; line-height:45px; font-size:22px; cursor:pointer; z-index:999999; box-shadow:0 4px 8px rgba(0,0,0,0.2); pointer-events:auto;";
        document.body.appendChild(engrenage);

        const boiteOptions = document.createElement('div');
        boiteOptions.style = "position:fixed; bottom:75px; right:20px; width:230px; background:white; border-radius:8px; border:1px solid #ccc; padding:15px; z-index:999999; display:none; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-family:sans-serif; color:#333;";
        boiteOptions.innerHTML = `<h4 style="margin:0 0 10px 0; color:#1877f2;">Filtre IA Actif</h4><p style="font-size:12px;margin:0;">Si l'icône est orange, l'IA se télécharge. Si elle devient verte, l'IA protège votre page.</p>`;
        document.body.appendChild(boiteOptions);

        engrenage.onclick = () => {
            boiteOptions.style.display = boiteOptions.style.display === 'none' ? 'block' : 'none';
        };
    }
})();
