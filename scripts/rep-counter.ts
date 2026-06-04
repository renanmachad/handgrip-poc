export enum GripState {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export interface RepCounterOptions {
  /** EMA smoothing factor in (0, 1]; lower means smoother but more lag. */
  smoothingFactor: number;
  /** Number of recent frames kept in the rolling min/max window. */
  windowSize: number;
  /** Frames required before the counter starts reacting. */
  minSamples: number;
  /** Minimum signal range to treat motion as a real grip (noise gate). */
  minRange: number;
  /** Fraction of the range below which the hand is considered closed. */
  closeRatio: number;
  /** Fraction of the range above which the hand is considered open. */
  openRatio: number;
}

const DEFAULT_OPTIONS: RepCounterOptions = {
  smoothingFactor: 0.2,
  windowSize: 60,
  minSamples: 20,
  minRange: 0.12,
  closeRatio: 0.35,
  openRatio: 0.75,
};

/** Read-only view of the counter's internal signal, for display or debugging. */
export interface RepCounterSnapshot {
  grip: number;
  range: number;
  state: GripState;
}

/**
 * Counts grip repetitions from a stream of raw grip samples.
 *
 * Each sample is smoothed with an exponential moving average and pushed into a
 * rolling window. Dynamic thresholds derived from that window's range drive a
 * two-state machine (OPEN ⇄ CLOSED); every full open → close → open cycle
 * increments the rep count. Thresholds are relative to recent motion, so the
 * counter adapts to different people and distances without calibration.
 */
export class RepCounter {
  private readonly options: RepCounterOptions;
  private readonly window: number[] = [];
  private smoothedGrip = 0;
  private state = GripState.OPEN;
  private repCount = 0;

  constructor(options: Partial<RepCounterOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get count(): number {
    return this.repCount;
  }

  /** Feeds one raw grip sample, advancing the state machine and rep count. */
  process(rawGrip: number): void {
    this.smoothedGrip = this.smooth(rawGrip);
    this.record(this.smoothedGrip);

    if (this.window.length < this.options.minSamples) return;

    const { min, max } = this.bounds();
    const range = max - min;
    if (range < this.options.minRange) return;

    this.advanceState(min, range);
  }

  snapshot(): RepCounterSnapshot {
    const hasEnoughSamples = this.window.length >= this.options.minSamples;
    const { min, max } = this.bounds();
    return {
      grip: this.smoothedGrip,
      range: hasEnoughSamples ? max - min : 0,
      state: this.state,
    };
  }

  private smooth(rawGrip: number): number {
    const factor = this.options.smoothingFactor;
    return factor * rawGrip + (1 - factor) * this.smoothedGrip;
  }

  private record(grip: number): void {
    this.window.push(grip);
    if (this.window.length > this.options.windowSize) {
      this.window.shift();
    }
  }

  private bounds(): { min: number; max: number } {
    if (this.window.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...this.window),
      max: Math.max(...this.window),
    };
  }

  private advanceState(min: number, range: number): void {
    const closeBelow = min + range * this.options.closeRatio;
    const openAbove = min + range * this.options.openRatio;
    const grip = this.smoothedGrip;

    switch (this.state) {
      case GripState.OPEN:
        if (grip < closeBelow) this.state = GripState.CLOSED;
        break;
      case GripState.CLOSED:
        if (grip > openAbove) {
          this.state = GripState.OPEN;
          this.repCount++;
        }
        break;
    }
  }
}
