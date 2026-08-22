// ==UserScript==
// @name         Test Alerte Native
// @namespace    http://tampermonkey.net
// @version      0.1
// @description  Alerte native pour vérifier si le script s'exécute du tout sur la page.
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
 
(function () {
  'use strict';
  alert("✅ TEST TAMPERMONKEY : le script s'exécute sur " + window.location.hostname);
})();
