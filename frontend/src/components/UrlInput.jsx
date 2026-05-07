import { useRef } from 'react';
import './UrlInput.css';

export default function UrlInput({ url, onChange, onSubmit, isLoading }) {
  const inputRef = useRef(null);

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text.trim());
      inputRef.current?.focus();
    } catch {
      // Clipboard permission denied — silently ignore
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !isLoading) onSubmit();
  }

  return (
    <div className="url-input">
      <div className="url-input__row">
        <div className="url-input__field-wrap">
          <span className="url-input__icon">🔗</span>
          <input
            ref={inputRef}
            className="url-input__field"
            type="text"
            value={url}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://suspicious-site.com/login"
            spellCheck={false}
            autoComplete="off"
            disabled={isLoading}
            aria-label="URL to check"
          />
          {url && (
            <button
              className="url-input__clear"
              onClick={() => onChange('')}
              title="Clear"
              aria-label="Clear URL"
            >
              ✕
            </button>
          )}
        </div>
        <button
          className="url-input__paste-btn"
          onClick={handlePaste}
          title="Paste from clipboard"
          disabled={isLoading}
        >
          📋
        </button>
        <button
          className="url-input__submit"
          onClick={onSubmit}
          disabled={isLoading || !url.trim()}
        >
          {isLoading ? (
            <span className="url-input__spinner" />
          ) : (
            'Check URL'
          )}
        </button>
      </div>
    </div>
  );
}
