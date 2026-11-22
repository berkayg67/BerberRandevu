export type Theme = "light" | "dark";

/** Kullanıcının seçimi bu anahtarla saklanır. Seçim yoksa sistem ayarı izlenir. */
export const THEME_STORAGE_KEY = "tema";

/** Telefonun durum çubuğu ve tarayıcı çerçevesi bu renge boyanır (sayfanın en üstündeki renk). */
export const THEME_COLORS: Record<Theme, string> = { light: "#f5f6fa", dark: "#0e1220" };

/**
 * Sayfa çizilmeden önce <head> içinde çalışır; böylece karanlık modda
 * açılışta beyaz bir an görünmez ve durum çubuğu doğru renkte başlar.
 */
export const themeBootScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var c=${JSON.stringify(THEME_COLORS)};var t=localStorage.getItem(k);var saved=t==="light"||t==="dark";if(!saved){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;if(saved){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c[t])})}}catch(e){document.documentElement.dataset.theme="light"}})();`;
