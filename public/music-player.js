// Trình phát nhạc nền dùng chung cho các overlay. Phát theo lệnh từ dashboard (qua WebSocket);
// hết bài thì báo máy chủ để chuyển bài. Khung xem trước (?preview) tự tắt tiếng.
export function createMusicPlayer(server, { onTrack = () => {} } = {}) {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.muted = new URLSearchParams(location.search).has('preview');
  let state = null;
  let currentUrl = null;

  audio.addEventListener('ended', () => {
    if (state) server.send({ type: 'musicEnded', index: state.index, seq: state.seq });
  });

  function apply(next) {
    state = next;
    const track = state.tracks[state.index];
    audio.volume = state.volume;
    if (!track) {
      audio.pause();
      currentUrl = null;
      onTrack(null, false);
      return;
    }
    if (track.url !== currentUrl) {
      currentUrl = track.url;
      audio.src = track.url;
    }
    if (state.playing) {
      // Một số trình duyệt chặn tự phát có tiếng; nguồn trình duyệt của OBS / LIVE Studio thường cho phép
      audio.play().catch((err) => console.warn('[nhạc] không tự phát được:', err.message));
    } else {
      audio.pause();
    }
    onTrack(track, state.playing);
  }

  return {
    handle(msg) {
      if (msg.type === 'hello' && msg.music) apply(msg.music);
      else if (msg.type === 'music') apply(msg.music);
    },
  };
}
