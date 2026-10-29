import { useState } from 'react';

/** A password input with a show/hide toggle. Accepts the same props as <input>. */
export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  const label = visible ? 'Hide password' : 'Show password';

  return (
    <span className="lynx-password">
      <input {...props} type={visible ? 'text' : 'password'} className="lynx-input" />
      <button type="button" className="lynx-password-toggle" onClick={() => setVisible((value) => !value)} aria-label={label} aria-pressed={visible} title={label}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}
