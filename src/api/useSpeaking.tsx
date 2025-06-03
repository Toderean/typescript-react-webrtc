import { useEffect, useState } from "react";

export function useSpeaking(stream: MediaStream | null, sensitivity = 20) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) return;
    let stopped = false;
    const audioCtx = new window.AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    source.connect(analyser);
    analyser.fftSize = 512;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setIsSpeaking(volume > sensitivity);
      if (!stopped) requestAnimationFrame(checkVolume);
    };
    checkVolume();
    return () => {
      stopped = true;
      audioCtx.close();
    };
  }, [stream, sensitivity]);

  return isSpeaking;
}
