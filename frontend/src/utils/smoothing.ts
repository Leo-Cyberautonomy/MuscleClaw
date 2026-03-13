/** Exponential Moving Average filter for smoothing landmark positions. */
export class EMAFilter {
  private value: number | null = null;
  private alpha: number;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha;
  }

  update(raw: number): number {
    if (this.value === null) { this.value = raw; return raw; }
    this.value = this.alpha * raw + (1 - this.alpha) * this.value;
    return this.value;
  }

  reset() { this.value = null; }
}
