import { useEffect, useRef, useCallback } from 'react';

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(frequency, duration, volume = 0.3, type = 'sine') {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

// Urgent alarm: two alternating tones
function playUrgentAlarm() {
  playTone(880, 0.15, 0.4, 'square');
  setTimeout(() => playTone(660, 0.15, 0.4, 'square'), 200);
  setTimeout(() => playTone(880, 0.15, 0.4, 'square'), 400);
}

// Gentle chime for medication
function playMedChime() {
  playTone(523, 0.2, 0.2, 'sine');
  setTimeout(() => playTone(659, 0.2, 0.2, 'sine'), 250);
  setTimeout(() => playTone(784, 0.3, 0.15, 'sine'), 500);
}

export function getMuted() {
  return localStorage.getItem('gv_sound_muted') === '1';
}

export function setMuted(val) {
  localStorage.setItem('gv_sound_muted', val ? '1' : '0');
}

// Hook: pass in alerts array, plays sound for critical alerts
export function useAudioAlerts(alerts = []) {
  const intervalRef = useRef(null);
  const lastAlertCountRef = useRef(0);

  const hasCritical = alerts.some(a =>
    (a.type === 'critical_low' || a.type === 'critical_high') && !a.acknowledged_at
  );

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!hasCritical) {
      lastAlertCountRef.current = 0;
      return;
    }

    const criticalCount = alerts.filter(a =>
      (a.type === 'critical_low' || a.type === 'critical_high') && !a.acknowledged_at
    ).length;

    // Play immediately if new critical alerts appeared
    if (criticalCount > lastAlertCountRef.current && !getMuted()) {
      playUrgentAlarm();
    }
    lastAlertCountRef.current = criticalCount;

    // Repeat every 10 seconds while critical alerts exist
    intervalRef.current = setInterval(() => {
      if (!getMuted() && document.visibilityState === 'visible') {
        playUrgentAlarm();
      }
    }, 10_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasCritical, alerts]);
}

export { playMedChime, playUrgentAlarm };
