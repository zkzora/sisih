# SISIH Mainnet product walkthrough video

This isolated branch contains a video-generation workflow. It does not modify SISIH application code and must not be merged into main.

## Output
- Real browser capture of Production Home, Connect and Proof.
- Terminal-style evidence replay built from archived, sanitized Mainnet records in docs/evidence/mainnet-20261108.
- Owner's ElevenLabs voiceover.
- Burned-in English subtitles and separate SRT.
- MP4, contact sheet and ZIP artifact.

## Required GitHub Actions secrets / variables
- Secret: ELEVENLABS_API_KEY
- Secret or repository variable: ELEVENLABS_VOICE_ID
- Optional variable: ELEVENLABS_MODEL_ID (defaults to eleven_multilingual_v2)

The workflow never prints credentials. It fails if ElevenLabs credentials are missing. No synthetic fallback voice is used.

## Truth and safety
- The Mainnet execution occurred on 8 November 2026. Terminal scenes are labeled as archived evidence.
- The public Production website is read-only. No purchase, approval, wallet signing or permission change is executed.
- The third request was blocked in the application; the contract simulation was unsigned and not broadcast.
- ChainScope is project-operated; that disclosure is retained.
- The workflow uploads a GitHub Actions artifact only. It does not publish the video, submit it, merge this branch, or deploy Production.
