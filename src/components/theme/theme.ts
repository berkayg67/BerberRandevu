export type Theme = "light" | "dark";

/** Kullanıcının seçimi bu anahtarla saklanır. Seçim yoksa sistem ayarı izlenir. */
export const THEME_STORAGE_KEY = "tema";

/**
 * Sayfa çizilmeden önce <head> içinde çalışır; böylece karanlık modda
 * açılışta beyaz bir an görünmez.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
