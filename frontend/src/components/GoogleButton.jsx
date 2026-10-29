import { useEffect, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptPromise;
function loadGoogleScript() {
  scriptPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => {
      scriptPromise = undefined;
      reject(new Error('Unable to load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Renders Google's own button; renders nothing when VITE_GOOGLE_CLIENT_ID is not set.
export default function GoogleButton({ text = 'continue_with', onCredential, onError }) {
  const container = useRef(null);
  const overlay = useRef(null);
  const callbacks = useRef({ onCredential, onError });
  callbacks.current = { onCredential, onError };

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => callbacks.current.onCredential(credential),
        });
        // Google's own button is rendered invisibly over our styled one, so a click is a real Google sign-in.
        window.google.accounts.id.renderButton(overlay.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          width: Math.min(container.current.offsetWidth || 320, 400),
        });
      })
      .catch((error) => callbacks.current.onError?.(error.message));

    return () => { cancelled = true; };
  }, [text]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <div ref={container} className="lynx-google-btn">
        <span className="lynx-google-face" aria-hidden="true">
          <GoogleLogo />
          Continue with Google
        </span>
        <div ref={overlay} className="lynx-google-overlay" />
      </div>
      <div className="lynx-auth-divider"><span>or</span></div>
    </>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-4 6.8-9.9 6.8-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
