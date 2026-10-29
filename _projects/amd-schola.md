---
layout: page
title: AMD Schola for Unity
description: Extending AMD Schola to Unity with reusable agent interfaces, episode control, and local ONNX inference.
permalink: /projects/amd-schola/
img: assets/img/amd-schola/return-to-base-scattered.jpeg
importance: 0
category: creations
related_publications: false
mermaid:
  enabled: true
  zoomable: true
_styles: |
  .schola-summary { border-left: 3px solid var(--global-theme-color); padding-left: 1.25rem; margin: 1.5rem 0 2rem; }
  .schola-summary p:last-child { margin-bottom: 0; }
  .schola-video { position: relative; width: 100%; aspect-ratio: 16 / 9; margin: 1.5rem 0 0.5rem; }
  .schola-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .schola-flow { overflow-x: auto; margin: 1.5rem 0; }
  .schola-flow svg { min-width: 680px; }
  .schola-gallery { margin-top: 1.5rem; }
  .schola-status th, .schola-status td { min-width: 9rem; vertical-align: top; }
---

Game engines provide rich environments for reinforcement learning, but connecting a scene to a learning framework requires more than attaching a model to a character. Developers need consistent ways to describe observations, apply actions, manage episodes, and run trained policies.

As part of an **AMD–University of Toronto experiential industry project**, our team is extending [AMD's original Schola toolkit](https://github.com/GPUOpen-LibrariesAndSDKs/Schola) from its Unreal Engine foundation to Unity. The aim is to make Unity environments usable with Schola's Python training ecosystem and bring exported policies back into the engine for local inference.

<div class="schola-summary" markdown="1">

**My role:** Unity integration lead and AMD partner liaison<br>
**Timeline:** September 2026–present · Progress documented through October 2026<br>
**Technologies:** C#, Unity 6.3, Python, ONNX, Protobuf, GitHub Actions

**Current outcome:** Working Unity agents, local episode control, and ONNX inference. End-to-end Unity–Python training integration remains unfinished.

</div>

## My role and contributions

My work connects interface design, integration, developer tooling, and communication with AMD. The underlying runtime is a team effort: teammates implemented the sensor and actuator paths, environment lifecycle, ONNX policy, and inference stepper.

- **Unity interface design.** I led the early design of environment, agent, sensor, actuator, and policy abstractions, and built an editor workflow prototype to support technical discussions with AMD.
- **Protocol-generation checks.** I wrote the Protobuf-to-C# generation script and its CI workflow. Nine regression tests cover tool integrity, missing or changed generated files, failed generation, baseline deletion, and preservation of Unity metadata.
- **Architecture and documentation.** I created architecture/UML diagrams, documented the demo's setup and failure cases, captured screenshots, and recorded the walkthrough. These artifacts explain how individual components become a usable workflow.
- **Partner coordination.** As AMD liaison, I coordinated communication, scheduled discussions, and brought questions about interfaces, integration, and scope to the partner team. I also assembled the Return to Base display demo and recorded its walkthrough to show AMD the team's progress.

My contribution to CI is specifically the code-generation tooling and checks, alongside review and merge support. The broader pipeline was built and integrated collaboratively.

## How the system works

The implemented local inference path follows an **observe → think → act** cycle:

<div class="schola-flow" markdown="1">

```mermaid
flowchart LR
    sensor[Position sensor] --> observation[Observation]
    observation --> policy[ONNX policy]
    policy --> action[Movement action]
    action --> actuator[Actuator]
    actuator --> scene[Updated scene]
    scene --> sensor
```

</div>

`PositionSensor` reads world position into a keyed observation. `SentisPolicy` evaluates the model through Unity Inference Engine, and `TranslateActuator` applies the resulting movement. `SimpleStepper` coordinates the cycle: all agents observe before any acts, and policy decisions are collected before actions are applied.

The shared `Space` and `Point` types describe what observations and actions contain. Matching keys, dimensions, and value counts is essential: a model can load successfully yet still be incompatible with an agent's input or output contract. Keeping these definitions explicit helps detect mismatches at the component boundary.

Separately, `ScholaEnvironment` provides local initialization, stepping, and reset behavior. A step applies actions, calculates reward and episode status, then collects observations. Reset restores the initial pose snapshot and notifies episode hooks. Those APIs establish the Unity side of episode management; they do not, by themselves, connect it to a Python trainer.

{% include figure.liquid path="assets/img/amd-schola/early-target-architecture.jpeg" class="img-fluid rounded" alt="Early target architecture showing Unity components, a proposed gRPC training connection, reused Python reinforcement-learning tools, and ONNX export back to Unity." caption="Early target architecture, not a completion diagram. The Unity–Python training connection shown here remains unfinished; local ONNX inference is implemented." zoomable=true %}

My generation tooling addresses another integration risk: protocol definitions and generated C# can drift apart. It uses checksum-verified generation tools and compares output without overwriting the committed baseline during checks. CI validates generation now; comparison against committed sources activates once the first generated C# baseline exists.

## From design to implementation

Before the runtime pieces came together, I created an **editor-only UI mockup** covering training, environments, agents, sensors, actuators, spaces, and inference. It gave us concrete screens to discuss how a Unity developer might configure Schola.

<div class="row schola-gallery">
  <div class="col-md-6">
    {% include figure.liquid path="assets/img/amd-schola/editor-training-mockup.png" class="img-fluid rounded" sizes="(min-width: 768px) 450px, 95vw" alt="Early Unity editor Training mockup with read-only Python environment and reinforcement-learning configuration fields." caption="Training workflow concept — editor-only mockup, no backend attached." zoomable=true %}
  </div>
  <div class="col-md-6">
    {% include figure.liquid path="assets/img/amd-schola/editor-inference-mockup.png" class="img-fluid rounded" sizes="(min-width: 768px) 450px, 95vw" alt="Early Unity editor Inference mockup showing proposed model, observation space, action space, and stepper settings." caption="Inference workflow concept — editor-only mockup, no backend attached." zoomable=true %}
  </div>
</div>

These images document the design process. Their configuration fields are read-only, and they do not train agents, execute policies, or save settings. The partner demonstration below uses the actual runtime components rather than this proposed interface.

The team has also added EditMode tests for observations, action validation, episode lifecycle, model compatibility, and stepping. CI includes formatting and metadata checks, Unity test automation, Python regression checks, protocol generation, and release tooling. The headless Unity smoke-test path still depends on a dedicated player project; existing mock-protocol checks are not evidence of completed Unity–Python integration.

## Partner progress demo: Return to Base

We created **Return to Base** as a display environment to show our AMD partner the progress we had made on the Unity toolkit. It is a presentation demo, not a required component or deliverable of the toolkit; Schola's functionality does not depend on this scene.

I assembled the scene using the team's runtime components. Six cube-shaped drones share a trained ONNX model and move toward a blue base, each using its own position observation and movement action. This gives us a simple, visible way to demonstrate the inference loop during a partner review.

Clicking a drone moves it away from the base. Dragging lets you place it elsewhere, and pressing Space scatters all six. Once released, the policy guides each drone home again. Orange drones turn green within the home threshold, while a counter makes the result easy to follow.

<div class="schola-video">
  <iframe
    src="https://www.youtube-nocookie.com/embed/utxF_vXdSw8"
    title="AMD Schola for Unity: partner progress demonstration — Return to Base"
    loading="lazy"
    allow="encrypted-media; picture-in-picture; fullscreen"
    allowfullscreen
  ></iframe>
</div>

[Watch the partner progress demo walkthrough on YouTube](https://youtu.be/utxF_vXdSw8).

{% include figure.liquid path="assets/img/amd-schola/return-to-base-scattered.jpeg" class="img-fluid rounded" alt="Six orange drones scattered around the blue base; the overlay identifies the trained ONNX model and shows zero of six drones home." caption="Scattered: six agents, one shared policy, and separate position observations." zoomable=true %}

<div class="row schola-gallery">
  <div class="col-md-6">
    {% include figure.liquid path="assets/img/amd-schola/return-to-base-returning.jpeg" class="img-fluid rounded" sizes="(min-width: 768px) 450px, 95vw" alt="Drones converge on the blue base; one drone has turned green and the counter reads one of six home." caption="Returning: each agent responds to its current position." zoomable=true %}
  </div>
  <div class="col-md-6">
    {% include figure.liquid path="assets/img/amd-schola/return-to-base-home.jpeg" class="img-fluid rounded" sizes="(min-width: 768px) 450px, 95vw" alt="Green drones overlap at the blue base, with the on-screen counter confirming six of six home." caption="Home: all six reach the destination. The demo permits overlap." zoomable=true %}
  </div>
</div>

This demonstrates **inference with an already-trained model**, not training during Play Mode. No Python process is needed to run it. The screenshots explicitly show the trained ONNX policy in the overlay; the demo also has a fallback controller, so movement alone would not establish that model inference was running.

## Current status and next steps

The following reflects the inspected October 2026 implementation and demo artifacts, rather than a claim of production readiness.

<div class="table-responsive schola-status" markdown="1">

| Area                           | Current state                                                               |
| ------------------------------ | --------------------------------------------------------------------------- |
| Agents, sensors, and actuators | Implemented, with keyed observation/action contracts and validation.        |
| Local episode control          | Initialization, step, reset, reward, and termination hooks implemented.     |
| ONNX inference                 | Policy execution and the observe–think–act stepper implemented.             |
| Editor interface               | Exploratory mockup; no connected backend.                                   |
| Unity–Python training          | Unfinished integration work; not part of the current demonstrated workflow. |
| Packaged setup sample          | In progress; intended to help developers set up and use the toolkit.        |
| Headless Unity smoke testing   | Workflow prepared; player project and integration prerequisites remain.     |

</div>

The next milestone is a reliable training connection that preserves the same observation/action contracts and episode semantics used locally. That needs to be followed by an importable setup sample and a headless Unity test that exercises the real connection.

[Watch the partner demo](https://youtu.be/utxF_vXdSw8) · [Explore upstream AMD Schola](https://github.com/GPUOpen-LibrariesAndSDKs/Schola) · [Contact me](mailto:mahi.mukati@mail.utoronto.ca)

<small>Demo captures, editor mockups, and architecture diagram by Mohammad Mahi Ali Mukati for the team project. AMD Schola is an AMD project. <a href="{{ '/assets/img/amd-schola/NOTICE.txt' | relative_url }}">Media attribution and license</a>.</small>
