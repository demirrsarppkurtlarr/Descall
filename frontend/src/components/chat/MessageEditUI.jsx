import { useRef, useCallback } from "react";

export default function MessageEditUI({ defaultValue, onSave, onCancel }) {
  const inputRef = useRef(null);

  const handleSave = useCallback(() => {
    onSave(inputRef.current?.value || "");
  }, [onSave]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSave(inputRef.current?.value || "");
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  }, [onSave, onCancel]);

  return (
    <div className="message-edit-ui">
      <input
        ref={inputRef}
        type="text"
        defaultValue={defaultValue}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <div className="edit-actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
