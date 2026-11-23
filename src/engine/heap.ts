/** Binary min-heap; insertion counters make otherwise equal priorities stable. */
export class Heap<T> {
  private items: T[] = [];
  constructor(private less: (a: T, b: T) => boolean) {}
  get size() {
    return this.items.length;
  }
  push(value: T) {
    const a = this.items;
    a.push(value);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return;
    const first = a[0],
      last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      while (true) {
        let j = i;
        const l = i * 2 + 1,
          r = l + 1;
        if (l < a.length && this.less(a[l], a[j])) j = l;
        if (r < a.length && this.less(a[r], a[j])) j = r;
        if (i === j) break;
        [a[i], a[j]] = [a[j], a[i]];
        i = j;
      }
    }
    return first;
  }
}
