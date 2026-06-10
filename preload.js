/**
 * preload.js — Electron Preload Script
 *
 * Bu fayl web sahifa va Electron asosiy jarayoni (main process) o'rtasida
 * xavfsiz ko'prik (bridge) vazifasini o'taydi.
 *
 * contextBridge.exposeInMainWorld orqali faqat ruxsat etilgan funksiyalar
 * sahifaga taqdim etiladi.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Sahifaga "electronAPI" nomi ostida xavfsiz API-ni taqdim etamiz
contextBridge.exposeInMainWorld('electronAPI', {

  // ─── Yashirin chop etish (Silent Print) ──────────────────────────────────
  // kiosk.js da window.print() o'rniga bu funksiya chaqiriladi
  silentPrint: () => ipcRenderer.invoke('silent-print'),

  // ─── Printerlar ro'yxati ───────────────────────────────────────────────
  getPrinters: () => ipcRenderer.invoke('get-printers'),

  // ─── Launcher: Rolni tanlash ───────────────────────────────────────────
  openRole: (role) => ipcRenderer.send('open-role', role),

  // ─── Dasturni yopish ───────────────────────────────────────────────────
  quitApp: () => ipcRenderer.send('quit-app'),

  // ─── Electron ekanligini aniqlash ──────────────────────────────────────
  isElectron: true,

});
