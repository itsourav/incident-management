export default function ToastContainer({ toasts }) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span className="toast-icon">{icons[t.type] || 'ℹ️'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}
