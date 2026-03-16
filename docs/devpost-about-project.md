# MuscleClaw - About the Project

## Inspiration

Working out alone has a strange contradiction: lifting is empowering, but training without a coach can also be frustrating, unsafe, and hard to measure. Beginners do not always know what to train, intermediate lifters struggle to judge form objectively, and even experienced people can miss signs of fatigue, asymmetry, or danger during heavy sets.

We wanted to build something that feels less like a chatbot and more like a real gym companion: a coach that can see what you are doing, talk back naturally, remember your history, and react in real time. The vision was simple: **Jarvis for the gym**. That idea became MuscleClaw.

Another big source of inspiration was the opportunity to push multimodal interaction beyond text. Instead of typing into a box, we wanted camera vision, live voice, gesture control, AR overlays, and a strong personality to work together in one experience. We also leaned into entertainment value, because for a live demo, coaching alone is not enough; it should be memorable. That is why MuscleClaw has three personalities, including a trash-talk mode that roasts you and coaches you at the same time.

## What it does

MuscleClaw is a real-time AI fitness coach that can see you, hear you, speak to you, and guide your workout.

It can:

- generate a training plan based on your recovery status and training history
- analyze your body profile and highlight which muscle groups are ready to train
- track reps in real time with range-of-motion validation
- correct form issues such as incomplete reps or left-right asymmetry
- run posture checks before and after training
- keep a persistent memory of training history, preferences, and body data
- detect dangerous situations like a stalled bench press and trigger a safety countdown
- support voice commands, mouse interaction, body-point interaction, and gesture-based control
- switch between three coaching personalities: `trash_talk`, `gentle`, and `professional`
- capture a showcase image and generate a more muscular "after" version for a fun demo moment

The end result feels closer to an interactive fitness agent than a traditional app. The user talks naturally, moves naturally, and gets immediate visual and audio feedback inside a camera-first interface.

## How we built it

We built MuscleClaw as a dual-layer multimodal system.

On the frontend, we used **React 19 + TypeScript + Vite** to create the camera-first interface. We used **MediaPipe** in the browser for fast pose and hand tracking, which gives us the real-time landmark data needed for rep counting, symmetry checks, gesture detection, posture scanning, and safety monitoring. The UI combines HTML/CSS panels with canvas-based overlays so that body cards, skeletons, and interactive feedback can stay visually anchored to the user.

On the backend, we used **FastAPI + WebSocket** to bridge the frontend to **Google ADK** and the **Gemini Live API**. The voice side of the system uses Gemini's native-audio live model for real-time conversation, while a separate text-model routing layer handles tool execution more reliably. That second layer decides when to call tools like:

- `get_body_profile`
- `generate_training_plan`
- `record_training_set`
- `analyze_posture`
- `trigger_safety_alert`
- `update_user_preferences`

We used **Firestore** to persist user-level state such as training history, preferences, and body profile, so the system remembers the user across sessions instead of acting like a blank slate every time. We deployed the app to **Google Cloud Run**, which lets the full stack run as a real hosted experience rather than a local-only prototype.

Architecturally, one of the most important decisions was separating **fast local perception** from **higher-level AI reasoning**:

- MediaPipe handles high-frequency motion understanding in the browser
- Gemini Live handles natural conversation and scene-aware multimodal interaction
- a tool-routing layer ensures that voice responses stay grounded in the same real data shown in the UI

That design helped us keep the experience both responsive and trustworthy.

## Challenges we ran into

The hardest challenge was balancing **real-time responsiveness** with **multimodal intelligence**.

Pose tracking and rep counting need fast, frame-by-frame local analysis, while live AI conversation works on a different timing model. That meant we had to design around two different "speeds" in the same product: browser-side computer vision for immediate motion events, and Gemini Live for voice and broader contextual understanding.

Another major challenge was tool reliability in live voice mode. Natural audio conversation is great for immersion, but if tool execution is inconsistent, the product quickly feels broken. We solved this by introducing a more reliable text-model routing layer for tool calling, then feeding the real tool results back into the live voice context so the spoken response matches the UI and stored data.

We also ran into challenges around:

- keeping voice responses grounded in real Firestore data instead of letting the model improvise numbers
- handling WebSocket interruptions without losing the user's training context
- designing a personality system that is funny enough for a demo, but still useful and not mean
- making AR overlays readable while the user is moving in front of the camera
- building a safety flow that feels serious and immediate, even though the rest of the product can be playful

## Accomplishments that we're proud of

We are proud that MuscleClaw feels like an actual product experience, not just a collection of model calls.

The biggest accomplishment is the interaction model itself: camera vision, live voice, gesture control, persistent state, and structured UI all work together around one coaching agent. That directly supports the "beyond text" idea we aimed for from day one.

We are also proud of:

- building a live AI coach with a distinct personality system instead of a generic assistant voice
- creating a system where trash talk is entertaining but still paired with real coaching
- grounding the agent in user data so the numbers in the voice response and the dashboard stay aligned
- implementing safety-aware behavior that becomes instantly serious when something dangerous happens
- shipping a Cloud Run deployment and a public GitHub repository for a real end-to-end submission

## What we learned

We learned that multimodal UX is much more than adding voice on top of a normal app. The hard part is orchestration: deciding what should happen locally, what should happen in the model, what should be persisted, and how each channel reinforces the others instead of competing with them.

We also learned that personality is a product feature, not just a prompt detail. A strong voice can make an experience feel alive, but only if it stays grounded, reacts at the right time, and respects context. In MuscleClaw, that meant the coach could be funny during normal training, but had to become completely serious during safety events.

On the technical side, we learned the value of separating:

- low-latency perception from higher-level reasoning
- tool execution from voice generation
- session state from ephemeral live connection state

That separation made the system more robust, more debuggable, and easier to evolve.

## What's next for MuscleClaw

The current version proves the core concept, but there is a lot we want to improve next.

Our next steps are:

- support more exercises and richer form-analysis rules across different equipment
- improve posture analysis with more detailed scoring and better before/after comparisons
- expand safety features beyond countdown alerts into richer escalation flows
- make gesture and air-touch interaction smoother and more reliable on lower-end devices
- improve the planning engine so it adapts better to recovery, fatigue, and progression over time
- add stronger session recovery and reconnection behavior for long workouts
- polish the showcase mode into a more complete social-sharing experience
- continue refining the voice system so the agent feels even more natural, fast, and emotionally aware

Long term, we see MuscleClaw becoming a full AI training companion: part coach, part safety system, part performance tracker, and part motivating presence in the gym.
