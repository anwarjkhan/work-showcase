// Server-safe theme constants (imported by app/layout.tsx, which is a server component).

export const THEME_STORAGE_KEY = 'di-theme';

/** Runs in <head> before paint: applies the remembered theme, else the system preference. */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','light')}})();`;
