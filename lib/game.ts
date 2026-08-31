export const COLOR_NAMES = ['墨', '赤', '橙', '金', '翠', '青', '蓝', '紫', '桃', '茶'] as const;
export const ROW_NAMES = ['上行', '中行', '下行'] as const;
export const ROW_SIZES = [2, 3, 3] as const;

export type Card = {
  id: string;
  number: number;
  color: number;
};

export type Board = Array<Array<Card | null>>;

export type HandStrength = {
  rank: number;
  key: number[];
  score: number;
  label: string;
  type: 'high' | 'pair' | 'straight' | 'trips' | 'flush' | 'straightFlush';
};

export type Special = {
  name: string;
  score: number;
  description: string;
};

export type BoardResult = {
  bust: boolean;
  baseScore: number;
  total: number;
  rows: HandStrength[];
  specials: Special[];
  topSpecial: Special | null;
};

export function createEmptyBoard(): Board {
  return ROW_SIZES.map((size) => Array<Card | null>(size).fill(null));
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (let color = 0; color < COLOR_NAMES.length; color += 1) {
    for (let number = 1; number <= 9; number += 1) {
      deck.push({ id: `${color}-${number}`, number, color });
    }
  }
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function isConsecutive(numbers: number[]): boolean {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted.every((number, index) => index === 0 || number === sorted[index - 1] + 1);
}

export function classify(cards: Card[], topRow = false): HandStrength {
  const numbers = cards.map((card) => card.number);
  const sortedDesc = [...numbers].sort((a, b) => b - a);
  const counts = new Map<number, number>();
  numbers.forEach((number) => counts.set(number, (counts.get(number) ?? 0) + 1));
  const countEntries = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  if (topRow) {
    const pairNumber = countEntries.find(([, count]) => count === 2)?.[0];
    if (pairNumber !== undefined) {
      return { rank: 1, key: [pairNumber], score: pairNumber, label: `对子 ${pairNumber}`, type: 'pair' };
    }
    return { rank: 0, key: sortedDesc, score: 0, label: `高牌 ${sortedDesc.join('·')}`, type: 'high' };
  }

  const sameColor = cards.every((card) => card.color === cards[0]?.color);
  const straight = cards.length === 3 && new Set(numbers).size === 3 && isConsecutive(numbers);
  const trips = countEntries[0]?.[1] === 3;
  const pairNumber = countEntries.find(([, count]) => count === 2)?.[0];

  if (sameColor && straight) {
    return { rank: 5, key: [Math.max(...numbers)], score: 10, label: `同色顺 ${Math.min(...numbers)}–${Math.max(...numbers)}`, type: 'straightFlush' };
  }
  if (sameColor) {
    return { rank: 4, key: sortedDesc, score: 7, label: `同色 ${sortedDesc.join('·')}`, type: 'flush' };
  }
  if (trips) {
    return { rank: 3, key: [numbers[0]], score: 5, label: `三条 ${numbers[0]}`, type: 'trips' };
  }
  if (straight) {
    return { rank: 2, key: [Math.max(...numbers)], score: 3, label: `顺子 ${Math.min(...numbers)}–${Math.max(...numbers)}`, type: 'straight' };
  }
  if (pairNumber !== undefined) {
    const kicker = numbers.find((number) => number !== pairNumber) ?? 0;
    return { rank: 1, key: [pairNumber, kicker], score: 2, label: `对子 ${pairNumber}`, type: 'pair' };
  }
  return { rank: 0, key: sortedDesc, score: 0, label: `高牌 ${sortedDesc.join('·')}`, type: 'high' };
}

export function compareStrength(left: HandStrength, right: HandStrength): number {
  if (left.rank !== right.rank) return left.rank - right.rank;
  const length = Math.min(left.key.length, right.key.length);
  for (let index = 0; index < length; index += 1) {
    if (left.key[index] !== right.key[index]) return left.key[index] - right.key[index];
  }
  return 0;
}

function cardsInBoard(board: Board): Card[] {
  return board.flat().filter((card): card is Card => card !== null);
}

function rowNumbersMatch(row: Array<Card | null>, expected: number[]): boolean {
  const numbers = row.filter((card): card is Card => card !== null).map((card) => card.number).sort((a, b) => a - b);
  return numbers.length === expected.length && numbers.every((number, index) => number === expected[index]);
}

function dragonTemplate(board: Board): boolean {
  const oneToEight = rowNumbersMatch(board[0], [1, 2]) && rowNumbersMatch(board[1], [3, 4, 5]) && rowNumbersMatch(board[2], [6, 7, 8]);
  const twoToNine = rowNumbersMatch(board[0], [2, 3]) && rowNumbersMatch(board[1], [4, 5, 6]) && rowNumbersMatch(board[2], [7, 8, 9]);
  return oneToEight || twoToNine;
}

function rowIsSameColor(row: Array<Card | null>): boolean {
  const cards = row.filter((card): card is Card => card !== null);
  return cards.length === row.length && cards.every((card) => card.color === cards[0].color);
}

export function findSpecials(board: Board): Special[] {
  const cards = cardsInBoard(board);
  if (cards.length !== 8) return [];
  const specials: Special[] = [];
  const uniqueColors = new Set(cards.map((card) => card.color)).size === 8;
  const numberCounts = new Map<number, number>();
  cards.forEach((card) => numberCounts.set(card.number, (numberCounts.get(card.number) ?? 0) + 1));
  const allCountsEven = [...numberCounts.values()].every((count) => count % 2 === 0);
  const allOdd = cards.every((card) => card.number % 2 === 1);
  const allEven = cards.every((card) => card.number % 2 === 0);
  const threeSnakes = isConsecutive(board[0].map((card) => card!.number))
    && isConsecutive(board[1].map((card) => card!.number))
    && isConsecutive(board[2].map((card) => card!.number));
  const dragon = dragonTemplate(board);
  const greenDragon = dragon && board.every(rowIsSameColor);

  if (uniqueColors) specials.push({ name: '异色', score: 7, description: '8 张牌颜色全不相同' });
  if (allCountsEven) specials.push({ name: '四对', score: 10, description: '每个数字都成双出现' });
  if (allOdd) specials.push({ name: '全单', score: 10, description: '8 张牌全部为单数' });
  if (allEven) specials.push({ name: '全双', score: 10, description: '8 张牌全部为双数' });
  if (threeSnakes) specials.push({ name: '三蛇', score: 10, description: '三行数字都连续' });
  if (dragon) specials.push({ name: '龙', score: 15, description: '三行依次组成 1–8 或 2–9' });
  if (dragon && uniqueColors) specials.push({ name: '异龙', score: 20, description: '龙且 8 张颜色全不同' });
  if (greenDragon) specials.push({ name: '青龙', score: 35, description: '龙且每一行内部同色' });
  return specials.sort((a, b) => b.score - a.score);
}

export function evaluateBoard(board: Board): BoardResult {
  const rows = board.map((row, index) => classify(row.filter((card): card is Card => card !== null), index === 0));
  const bust = compareStrength(rows[1], rows[0]) < 0 || compareStrength(rows[2], rows[1]) < 0;
  const baseScore = bust ? 0 : rows.reduce((total, row) => total + row.score, 0);
  const specials = findSpecials(board);
  const topSpecial = specials[0] ?? null;
  return {
    bust,
    baseScore,
    total: Math.max(baseScore, topSpecial?.score ?? 0),
    rows,
    specials,
    topSpecial,
  };
}

export function isBoardComplete(board: Board): boolean {
  return board.every((row) => row.every(Boolean));
}

export function dealWave(deck: Card[], count: number): { deck: Card[]; hands: Card[][] } {
  const hands = Array.from({ length: 6 }, (_, player) => deck.slice(player * count, (player + 1) * count));
  return { deck: deck.slice(count * 6), hands };
}

type Slot = [number, number];

function combinations<T>(items: T[], count: number, start = 0, chosen: T[] = [], result: T[][] = []): T[][] {
  if (chosen.length === count) {
    result.push([...chosen]);
    return result;
  }
  for (let index = start; index <= items.length - (count - chosen.length); index += 1) {
    chosen.push(items[index]);
    combinations(items, count, index + 1, chosen, result);
    chosen.pop();
  }
  return result;
}

function permutations<T>(items: T[], count: number, chosen: T[] = [], used = new Set<number>(), result: T[][] = []): T[][] {
  if (chosen.length === count) {
    result.push([...chosen]);
    return result;
  }
  items.forEach((item, index) => {
    if (used.has(index)) return;
    used.add(index);
    chosen.push(item);
    permutations(items, count, chosen, used, result);
    chosen.pop();
    used.delete(index);
  });
  return result;
}

function partialRowValue(cards: Card[], rowIndex: number): number {
  if (!cards.length) return 0;
  const colorCounts = new Map<number, number>();
  const numberCounts = new Map<number, number>();
  cards.forEach((card) => {
    colorCounts.set(card.color, (colorCounts.get(card.color) ?? 0) + 1);
    numberCounts.set(card.number, (numberCounts.get(card.number) ?? 0) + 1);
  });
  const maxColor = Math.max(...colorCounts.values());
  const maxNumber = Math.max(...numberCounts.values());
  const numbers = cards.map((card) => card.number);
  const adjacent = numbers.some((number) => numbers.includes(number + 1));
  const rowWeight = [0.68, 1, 1.22][rowIndex];
  return rowWeight * (maxColor * 4 + maxNumber * 6 + (adjacent ? 5 : 0) + numbers.reduce((a, b) => a + b, 0) * 0.18);
}

function partialBoardValue(board: Board): number {
  if (isBoardComplete(board)) {
    const result = evaluateBoard(board);
    const lowerKey = result.rows[2].rank * 40 + result.rows[2].key.reduce((a, b) => a * 10 + b, 0);
    return result.total * 1000 + result.baseScore * 30 + lowerKey;
  }

  let score = 0;
  const completed: Array<HandStrength | null> = board.map((row, index) => {
    const cards = row.filter((card): card is Card => card !== null);
    score += partialRowValue(cards, index);
    if (cards.length !== row.length) return null;
    const strength = classify(cards, index === 0);
    score += strength.rank * 35 + strength.score * 12;
    return strength;
  });
  if (completed[0] && completed[1] && compareStrength(completed[1], completed[0]) < 0) score -= 1500;
  if (completed[1] && completed[2] && compareStrength(completed[2], completed[1]) < 0) score -= 1500;

  const cards = cardsInBoard(board);
  if (new Set(cards.map((card) => card.color)).size === cards.length) score += cards.length * 1.4;
  if (cards.every((card) => card.number % 2 === 1) || cards.every((card) => card.number % 2 === 0)) score += cards.length;

  const templates = [
    [[1, 2], [3, 4, 5], [6, 7, 8]],
    [[2, 3], [4, 5, 6], [7, 8, 9]],
  ];
  const bestDragonFit = Math.max(...templates.map((template) => board.reduce((total, row, rowIndex) => (
    total + row.filter((card) => card && template[rowIndex].includes(card.number)).length
  ), 0)));
  score += bestDragonFit * 2.5;
  return score;
}

export function chooseAiBoard(board: Board, hand: Card[], placeCount: number): Board {
  const emptySlots: Slot[] = [];
  board.forEach((row, rowIndex) => row.forEach((card, cardIndex) => {
    if (!card) emptySlots.push([rowIndex, cardIndex]);
  }));
  const slotGroups = combinations(emptySlots, placeCount);
  const cardOrders = permutations(hand, placeCount);
  let bestBoard = cloneBoard(board);
  let bestValue = Number.NEGATIVE_INFINITY;

  slotGroups.forEach((slots) => {
    cardOrders.forEach((cards) => {
      const candidate = cloneBoard(board);
      slots.forEach(([row, column], index) => { candidate[row][column] = cards[index]; });
      const value = partialBoardValue(candidate) + Math.random() * 0.08;
      if (value > bestValue) {
        bestValue = value;
        bestBoard = candidate;
      }
    });
  });
  return bestBoard;
}
