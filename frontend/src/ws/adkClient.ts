import { useAppStore } from '../stores/appStore';

type MessageHandler = {
  onAudio?: (pcm: ArrayBuffer) => void;
  onTranscript?: (role: 'user' | 'model', text: string) => void;
  onUICommand?: (command: string, data: any) => void;
};

class ADKClient {
  private ws: WebSocket | null = null;
  private handlers: MessageHandler = {};
  private reconnectAttempts = 0;
  private userId: string;

  constructor() {
    this.userId = localStorage.getItem('muscleclaw_user_id') || crypto.randomUUID();
    localStorage.setItem('muscleclaw_user_id', this.userId);
  }

  connect(handlers: MessageHandler) {
    this.handlers = handlers;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${location.hostname}:8000`;
    this.ws = new WebSocket(`${host}/ws/${this.userId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      useAppStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
      console.log('[ADK] Connected');
    };

    this.ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        this.handlers.onAudio?.(ev.data);
      } else {
        try {
          const msg = JSON.parse(ev.data);
          this.handleJSON(msg);
        } catch (e) { console.warn('[ADK] Bad JSON:', ev.data); }
      }
    };

    this.ws.onclose = () => {
      useAppStore.getState().setConnected(false);
      this.tryReconnect();
    };

    this.ws.onerror = () => this.ws?.close();
  }

  private handleJSON(msg: any) {
    switch (msg.type) {
      case 'transcript':
        this.handlers.onTranscript?.(msg.role, msg.text);
        useAppStore.getState().addTranscript(msg.role, msg.text);
        break;
      case 'ui_command':
        this.handleUICommand(msg.command, msg.data);
        break;
    }
  }

  private handleUICommand(command: string, data: any) {
    const store = useAppStore.getState();
    switch (command) {
      case 'switch_mode': store.setMode(data.mode); break;
      case 'show_body_panel': store.setBodyProfile(data.profile); store.setMode('body_scan'); break;
      case 'show_training_plan': store.setTrainingPlan(data.plan); store.setMode('planning'); break;
      case 'show_safety_alert': store.setSafetyAlert(true, data.countdown_seconds); break;
      case 'cancel_safety_alert': store.setSafetyAlert(false); break;
      case 'start_rest_timer': store.setRestTimer(data.seconds); break;
      case 'update_set_info': store.updateTraining(data); break;
    }
    this.handlers.onUICommand?.(command, data);
  }

  sendAudio(pcm: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(pcm);
  }

  sendVideoFrame(jpegBase64: string) {
    this.sendJSON({ type: 'video_frame', data: jpegBase64 });
  }

  sendCVEvent(event: any) {
    this.sendJSON({ type: 'cv_event', event });
  }

  sendText(text: string) {
    this.sendJSON({ type: 'text', text });
  }

  private sendJSON(obj: any) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  private tryReconnect() {
    if (this.reconnectAttempts >= 5) return;
    const delay = [0, 1000, 3000, 5000, 10000][this.reconnectAttempts] || 10000;
    this.reconnectAttempts++;
    setTimeout(() => this.connect(this.handlers), delay);
  }

  disconnect() { this.ws?.close(); }
}

export const adkClient = new ADKClient();
