// Kết nối WebSocket tới máy chủ, tự kết nối lại nếu máy chủ khởi động lại.
export function connectWS(onMessage, onOpenChange = () => {}) {
  let ws;
  let retry = 0;
  const api = {
    send(msg) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  const open = () => {
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      onOpenChange(true);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      // Lệnh tải lại từ dashboard: overlay trong OBS/LIVE Studio tự nạp bản mới, không cần bấm Refresh
      if (msg.type === 'reload' && !location.pathname.startsWith('/dashboard')) return location.reload();
      onMessage(msg);
    };
    ws.onclose = () => {
      onOpenChange(false);
      setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
    };
  };
  open();
  return api;
}

export function initials(name) {
  return (String(name || '?').trim()[0] || '?').toUpperCase();
}
