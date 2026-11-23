// Server-safe theme and labels constants (imported by app/layout.tsx, which is a server component).

export const THEME_STORAGE_KEY = 'di-theme';
export const LABELS_STORAGE_KEY = 'di-labels';

/**
 * Runs in <head> before paint: applies the remembered theme (else the system
 * preference) to `data-theme`, and the remembered labels mode to `data-labels`
 * ("on" unless the stored value is exactly "off").
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.setAttribute('data-theme',t)}catch(e){d.setAttribute('data-theme','light')}try{d.setAttribute('data-labels',localStorage.getItem('${LABELS_STORAGE_KEY}')==='off'?'off':'on')}catch(e){d.setAttribute('data-labels','on')}})();`;
