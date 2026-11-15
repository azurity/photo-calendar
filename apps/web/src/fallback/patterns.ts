export interface FallbackPattern {
  name: string;
  rule: string;
}

/**
 * 无照片日的 css-doodle 图样库。
 *
 * 规则只使用静态 CSS，不包含动画；seed 由日期确定。
 */
export const PATTERNS: readonly FallbackPattern[] = [
  {
    name: '慢下来的格子',
    rule: `@grid: 9x9 / 100vw 100vh;
background: #1b1713;
@nth(3n) {
  background: #a94e2f;
  opacity: .42;
  border-radius: 50%;
  transform: scale(.62);
}
@nth(3n + 1) { background: #d9a48d; opacity: .18; }`,
  },
  {
    name: '向外走的圆',
    rule: `@grid: 11x11 / 100vw 100vh;
background: #1b1713;
@place-cell: center;
border-radius: 50%;
border: 1px solid rgba(255, 250, 241, .18);
background: radial-gradient(circle, rgba(217, 164, 141, .22), transparent 64%);
transform: scale(.34);`,
  },
  {
    name: '傍晚的波纹',
    rule: `@grid: 8x18 / 100vw 100vh;
background: #1b1713;
@nth(2n) {
  background: rgba(217, 164, 141, .28);
  transform: translateY(8px) scaleY(.5);
  border-radius: 50%;
}
@nth(5n) { background: rgba(117, 137, 128, .32); }`,
  },
  {
    name: '窗与光',
    rule: `@grid: 6x6 / 100vw 100vh;
background: #1b1713;
@nth(4n) {
  background: linear-gradient(145deg, rgba(217, 164, 141, .45), rgba(169, 78, 47, .08));
  transform: scale(.74);
  border-radius: 2px;
}
@nth(4n + 2) { border: 1px solid rgba(255, 250, 241, .16); }`,
  },
  {
    name: '山的折线',
    rule: `@grid: 20x20 / 100vw 100vh;
background: #1b1713;
@nth(2n) {
  background: rgba(255, 250, 241, .12);
  transform: rotate(12deg) scale(.8);
}
@nth(7n) { background: rgba(169, 78, 47, .28); }`,
  },
  {
    name: '夜里的星群',
    rule: `@grid: 24x24 / 100vw 100vh;
background: #12100e;
@nth(7n) {
  background: #f5dfc8;
  border-radius: 50%;
  transform: scale(.32);
  opacity: .72;
}
@nth(11n) { background: #d9a48d; }`,
  },
  {
    name: '纸上的风',
    rule: `@grid: 10x10 / 100vw 100vh;
background: #1b1713;
@nth(3n) {
  background: rgba(255, 250, 241, .11);
  transform: rotate(35deg) scaleX(1.8);
}
@nth(5n) { background: rgba(217, 164, 141, .28); border-radius: 999px; }`,
  },
  {
    name: '远行的路',
    rule: `@grid: 14x14 / 100vw 100vh;
background: #17130f;
@place-cell: center;
border-radius: 50%;
background: linear-gradient(90deg, rgba(169, 78, 47, .34), rgba(217, 164, 141, .12));
transform: scale(.6) translateX(6px);`,
  },
  {
    name: '旧地图',
    rule: `@grid: 16x16 / 100vw 100vh;
background: #1b1713;
@nth(3n) {
  border: 1px solid rgba(217, 164, 141, .34);
  transform: rotate(4deg);
}
@nth(6n + 1) { background: rgba(255, 250, 241, .08); }`,
  },
  {
    name: '潮汐',
    rule: `@grid: 12x12 / 100vw 100vh;
background: #141b19;
@nth(2n) {
  background: rgba(117, 137, 128, .36);
  border-radius: 50%;
  transform: scaleX(1.5) scaleY(.45);
}
@nth(9n) { background: rgba(217, 164, 141, .25); }`,
  },
  {
    name: '灯与影子',
    rule: `@grid: 7x7 / 100vw 100vh;
background: #1b1713;
@nth(3n) {
  background: radial-gradient(circle at center, rgba(217, 164, 141, .55), transparent 62%);
  transform: scale(.9);
}
@nth(4n) { background: rgba(255, 250, 241, .06); }`,
  },
  {
    name: '缓缓打开的窗',
    rule: `@grid: 8x8 / 100vw 100vh;
background: #1b1713;
@nth(4n) {
  background: linear-gradient(180deg, rgba(169, 78, 47, .34), transparent);
  transform: scale(.8);
}
@nth(4n + 2) {
  border: 1px solid rgba(217, 164, 141, .28);
  transform: scale(.92);
}`,
  },
] as const;
