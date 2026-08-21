// ==UserScript==
// @name         Filtre Facebook IA Avancé
// @namespace    http://tampermonkey.net
// @version      1.5
// @description  Filtre intelligent local contre la haine, l'ironie blessante et le spam sur Facebook.
// @author       Votre Nom
// @match        https://*://*
// @match        https://m://*
// @match        https://github.io*
// @connect      cdn.jsdelivr.net
// @connect      huggingface.co
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://jsdelivr.net
// ==/UserScript==

(async function() {
    'use strict';

    // 1. Détection immédiate de la page : si on est sur GitHub, on valide le test visuel
    if (window.location.href.includes('github.io')) {
        creerEngrenageTestGris();
        return; // On s'arrête là pour la page de téléchargement
    }

    // 2. Code pour Facebook
    let seuilSensibilite = GM_getValue("seuil_sensibilite", 0.65);
    let pipelineAnalyseur = null;

    creerBoutonConfigurationFacebook();

    async function initIA() {
        try {
            pipelineAnalyseur = await window.Transformers.pipeline('text-classification', 'Xenova/toxic-bert');
            const engrenage = document.getElementById('ia-engrenage-flottant');
            if (engrenage) engrenage.style.background = "#28a745"; // Vert si OK
        } catch (erreur) {
            const engrenage = document.getElementById('ia-engrenage-flottant');
            if (engrenage) engrenage.style.background = "#dc3545"; // Rouge si erreur
        }
    }
    await initIA();

    // FONCTIONS POUR DESSINER LES BOUTONS

    // Ce bouton s'affiche UNIQUEMENT sur votre page GitHub pour prouver que le script tourne
    function creerEngrenageTestGris() {
        if (document.getElementById('ia-engrenage-test')) return;
        const engrenageTest = document.createElement('div');
        engrenageTest.id = 'ia-engrenage-test';
        engrenageTest.innerHTML = "⚙️";
        engrenageTest.style = "position:fixed; bottom:20px; right:20px; width:55px; height:55px; background:#007bff; color:white; border-radius:50%; text-align:center; line-height:55px; font-size:26px; z-index:999999; box-shadow:0 4px 12px rgba(0,0,0,0.3);";
        document.body.appendChild(engrenageTest);
        
        // Petit message d'explication au clic
        engrenageTest.onclick = () => { alert("🎉 Bravo ! L'extension Userscripts fonctionne parfaitement sur cette page !"); };
    }

    // Ce bouton s'affiche sur Facebook
    function creerBoutonConfigurationFacebook() {
        if (document.getElementById('ia-engrenage-flottant')) return;
        const engrenage = document.createElement('div');
        engrenage.id = 'ia-engrenage-flottant';
        engrenage.innerHTML = "⚙️";
        engrenage.style = "position:fixed; bottom:20px; right:20px; width:45px; height:45px; background:#ff9800; color:white; border-radius:50%; text-align:center; line-height:45px; font-size:22px; cursor:pointer; z-index:999999; box-shadow:0 4px 8px rgba(0,0,0,0.2);";
        document.body.appendChild(engrenage);
    }
})();
