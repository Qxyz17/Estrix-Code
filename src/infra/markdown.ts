/**
 * Markdown 围栏常量（共享）
 * 反引号与三反引号围栏，用字符码构造避免源码转义问题。
 * bridge 与 overlay 都依赖 infra，故置于此。
 */
const BT = String.fromCharCode(96);
const FENCE = BT + BT + BT;

export { BT, FENCE };
