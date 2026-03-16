import { useAppStore } from '../stores/appStore';
import { useTrainingStore } from '../stores/trainingStore';
import { usePoseStore } from '../stores/poseStore';
import { useUIStore } from '../stores/uiStore';

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
  private pendingAudioRate: number | null = null;

  constructor() {
    this.userId = localStorage.getItem('muscleclaw_user_id') || crypto.randomUUID();
    localStorage.setItem('muscleclaw_user_id', this.userId);
  }

  connect(handlers: MessageHandler) {
    this.handlers = handlers;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || `${protocol}//${location.host}`;
    this.ws = new WebSocket(`${host}/ws/${this.userId}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      useAppStore.getState().setConnected(true);
      this.reconnectAttempts = 0;
      console.log('[ADK] Connected');
      // Send queued audio config now that WS is open
      if (this.pendingAudioRate) {
        this.sendJSON({ type: 'audio_config', sample_rate: this.pendingAudioRate });
        console.log(`[ADK] Sent audio_config: ${this.pendingAudioRate}Hz`);
        this.pendingAudioRate = null;
      }
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
      case 'state_sync':
        this.handleStateSync(msg.key, msg.data);
        break;
      case 'ui_command':
        this.handleUICommand(msg.command, msg.data);
        break;
    }
  }

  /** Data layer: backend pushes state changes → update stores */
  private handleStateSync(key: string, data: any) {
    const app = useAppStore.getState();
    const training = useTrainingStore.getState();
    const pose = usePoseStore.getState();

    switch (key) {
      case 'user:body_profile': app.setBodyProfile(data); break;
      case 'user:preferences': app.setPreferences(data); break;
      case 'user:training_history': training.setTrainingHistory(data); break;
      case 'user:posture_report': pose.setPostureReport(data); break;
      case 'current_plan': training.setTrainingPlan(data); break;
      case 'temp:workflow_step': training.setWorkflowStep(data); break;
      case 'ui_command': this.handleUICommand(data.command, data.data); return;
    }
    console.log(`[ADK] State sync: ${key}`);
  }

  private handleUICommand(command: string, data: any) {
    const app = useAppStore.getState();
    const training = useTrainingStore.getState();
    const ui = useUIStore.getState();

    switch (command) {
      case 'switch_mode': app.setMode(data.mode); break;
      case 'show_body_panel': app.setBodyProfile(data.profile); app.setMode('dashboard'); break;
      case 'show_training_plan': {
        // data.plan may be the plan object, or data itself may be the plan
        const plan = data.plan ?? data;
        console.log('[UI] Training plan received:', plan);
        training.setTrainingPlan(plan);
        app.setMode('planning');
        break;
      }
      case 'show_posture_report': app.setMode('posture'); break;
      case 'show_safety_alert': ui.setSafetyAlert(true, data.countdown_seconds); break;
      case 'cancel_safety_alert': ui.setSafetyAlert(false); break;
      case 'start_rest_timer': training.setRestTimer(data.seconds); break;
      case 'update_set_info': training.updateTraining(data); break;
    }
    this.handlers.onUICommand?.(command, data);
  }

  /** Queue audio sample rate — sent on WS open or immediately if already open */
  setAudioRate(rate: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendJSON({ type: 'audio_config', sample_rate: rate });
      console.log(`[ADK] Sent audio_config: ${rate}Hz`);
    } else {
      this.pendingAudioRate = rate;
    }
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

  sendJSON(obj: any) {
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
