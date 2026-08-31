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

export type PracticeCardValue = {
  playExpected: number;
  discardExpected: number;
  delta: number;
  recommended: boolean;
  target: { row: number; column: number } | null;
};

export type PracticeOutcome = {
  label: string;
  probability: number;
};

export type PracticeDiscardOption = {
  card: Card;
  expectedScore: number;
  gap: number;
  recommendation: Board;
};

export type PracticeReport = {
  discarded: Card | null;
  reasons: string[];
  discardOptions: PracticeDiscardOption[];
  rowOutcomes: PracticeOutcome[][];
  specialOutcomes: PracticeOutcome[];
  validRate: number;
  unseenCount: number;
};

export type PracticeAnalysis = {
  recommendation: Board;
  expectedScore: number;
  samples: number;
  approximate: boolean;
  cards: Record<string, PracticeCardValue>;
  report: PracticeReport;
};

export function createEmptyBoard(): Board {
  return ROW_SIZES.map((size) => Array<Card | null>(size).fill(null));
}

export function createFullDeck(): Card[] {
  const deck: Card[] = [];
  for (let color = 0; color < COLOR_NAMES.length; color += 1) {
    for (let number = 1; number <= 9; number += 1) {
      deck.push({ id: `${color}-${number}`, number, color });
    }
  }
  return deck;
}

export function createDeck(): Card[] {
  const deck = createFullDeck();
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

type PlacementOption = {
  board: Board;
  usedIds: Set<string>;
  heuristic: number;
};

function placementOptions(board: Board, hand: Card[], placeCount: number): PlacementOption[] {
  const emptySlots: Slot[] = [];
  board.forEach((row, rowIndex) => row.forEach((card, cardIndex) => {
    if (!card) emptySlots.push([rowIndex, cardIndex]);
  }));
  const slotGroups = combinations(emptySlots, placeCount);
  const cardOrders = permutations(hand, placeCount);
  const options: PlacementOption[] = [];
  slotGroups.forEach((slots) => {
    cardOrders.forEach((cards) => {
      const candidate = cloneBoard(board);
      slots.forEach(([row, column], index) => { candidate[row][column] = cards[index]; });
      options.push({
        board: candidate,
        usedIds: new Set(cards.map((card) => card.id)),
        heuristic: partialBoardValue(candidate),
      });
    });
  });
  return options;
}

function bestHeuristicBoard(board: Board, hand: Card[], placeCount: number): Board {
  const options = placementOptions(board, hand, placeCount);
  return options.reduce((best, option) => option.heuristic > best.heuristic ? option : best).board;
}

function bestFinalOption(board: Board, hand: Card[], placeCount: number): PlacementOption {
  const options = placementOptions(board, hand, placeCount);
  return options.reduce((best, option) => {
    const result = evaluateBoard(option.board);
    const tieBreak = result.baseScore * 100 + option.heuristic;
    const bestResult = evaluateBoard(best.board);
    const bestTieBreak = bestResult.baseScore * 100 + best.heuristic;
    return result.total > bestResult.total || (result.total === bestResult.total && tieBreak > bestTieBreak) ? option : best;
  });
}

function bestFinalScore(board: Board, hand: Card[], placeCount: number): number {
  return evaluateBoard(bestFinalOption(board, hand, placeCount).board).total;
}

function makeSeed(board: Board, hand: Card[], waveIndex: number): number {
  const text = `${waveIndex}|${board.flat().map((card) => card?.id ?? 'x').join(',')}|${hand.map((card) => card.id).sort().join(',')}`;
  let seed = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0 || 1;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function sampleCards(pool: Card[], count: number, random: () => number): Card[] {
  const copy = [...pool];
  for (let index = 0; index < count; index += 1) {
    const swapIndex = index + Math.floor(random() * (copy.length - index));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, count);
}

function uniqueShortlist(options: PlacementOption[], hand: Card[]): PlacementOption[] {
  const ranked = [...options].sort((left, right) => right.heuristic - left.heuristic);
  const chosen = new Set<PlacementOption>();
  ranked.slice(0, 32).forEach((option) => chosen.add(option));
  hand.forEach((card) => {
    ranked.filter((option) => option.usedIds.has(card.id)).slice(0, 12).forEach((option) => chosen.add(option));
    ranked.filter((option) => !option.usedIds.has(card.id)).slice(0, 12).forEach((option) => chosen.add(option));
  });
  return [...chosen];
}

const TYPE_LABELS: Record<HandStrength['type'], string> = {
  high: '高牌',
  pair: '对子',
  straight: '顺子',
  trips: '三条',
  flush: '同色',
  straightFlush: '同色顺',
};

function outcomeDistribution(labels: string[]): PracticeOutcome[] {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, probability: count / labels.length }))
    .sort((left, right) => right.probability - left.probability || left.label.localeCompare(right.label, 'zh-CN'));
}

function cardName(card: Card): string {
  return `${COLOR_NAMES[card.color]} ${card.number}`;
}

function rowPlanReason(before: Board, after: Board, rowIndex: number): string | null {
  const newCards = after[rowIndex].filter((card): card is Card => Boolean(card && !before[rowIndex].some((oldCard) => oldCard?.id === card.id)));
  if (!newCards.length) return null;
  const cards = after[rowIndex].filter((card): card is Card => card !== null);
  const placedText = newCards.map(cardName).join('、');
  if (cards.length === after[rowIndex].length) {
    const strength = classify(cards, rowIndex === 0);
    return `${ROW_NAMES[rowIndex]}放 ${placedText}，立即组成${strength.label}；牌力为这一行后续排序提供确定基础。`;
  }

  const sameColor = cards.length > 1 && cards.every((card) => card.color === cards[0].color);
  const numberCounts = new Map<number, number>();
  cards.forEach((card) => numberCounts.set(card.number, (numberCounts.get(card.number) ?? 0) + 1));
  const hasPair = [...numberCounts.values()].some((count) => count >= 2);
  const numbers = cards.map((card) => card.number);
  const connected = numbers.some((number) => numbers.includes(number + 1) || numbers.includes(number + 2));
  const routes = [hasPair && '对子/三条', sameColor && '同色', connected && '顺子'].filter(Boolean);
  return `${ROW_NAMES[rowIndex]}先放 ${placedText}${routes.length ? `，同时保留${routes.join('、')}路线` : '，为后续补牌保留较宽的数字与颜色空间'}。`;
}

function buildPracticeReasons(
  board: Board,
  hand: Card[],
  bestOption: PlacementOption,
  discardOptions: PracticeDiscardOption[],
  validRate: number,
  rowOutcomes: PracticeOutcome[][],
): string[] {
  const discarded = hand.find((card) => !bestOption.usedIds.has(card.id)) ?? null;
  const reasons: string[] = [];
  const runnerUp = [...discardOptions].sort((left, right) => right.expectedScore - left.expectedScore)[1];
  if (discarded) {
    const bestDiscard = discardOptions.find((option) => option.card.id === discarded.id);
    const edge = bestDiscard && runnerUp ? bestDiscard.expectedScore - runnerUp.expectedScore : 0;
    reasons.push(edge > 0.04
      ? `弃掉 ${cardName(discarded)} 后的最优路线，比次优弃牌方案多 ${edge.toFixed(1)} 分期望。`
      : `弃掉 ${cardName(discarded)} 与次优选择非常接近；当前落位在牌序稳定性与后续成牌空间上胜出。`);
  }
  for (let rowIndex = 0; rowIndex < bestOption.board.length; rowIndex += 1) {
    const reason = rowPlanReason(board, bestOption.board, rowIndex);
    if (reason) reasons.push(reason);
    if (reasons.length >= 4) break;
  }
  const strongestFuture = rowOutcomes
    .flatMap((outcomes, rowIndex) => outcomes.map((outcome) => ({ ...outcome, rowIndex })))
    .filter((outcome) => outcome.label !== '高牌')
    .sort((left, right) => right.probability - left.probability)[0];
  if (strongestFuture) reasons.push(`按这条路线继续，${ROW_NAMES[strongestFuture.rowIndex]}最常见的计分成牌是${strongestFuture.label}（推演占比 ${(strongestFuture.probability * 100).toFixed(0)}%）。`);
  reasons.push(validRate >= 0.995
    ? '所有推演结果都保持下行 ≥ 中行 ≥ 上行，没有出现炸牌。'
    : `推演中有 ${(validRate * 100).toFixed(0)}% 的结果不炸牌，推荐落位优先控制了整局归零风险。`);
  return reasons;
}

export function analyzePracticeMove(
  board: Board,
  hand: Card[],
  unseenPool: Card[],
  waveIndex: number,
): PracticeAnalysis {
  const placeCount = [3, 3, 2][waveIndex];
  const allOptions = placementOptions(board, hand, placeCount);
  const evaluatedOptions = waveIndex === 0 ? uniqueShortlist(allOptions, hand) : allOptions;
  const sampleCount = waveIndex === 0 ? 24 : waveIndex === 1 ? 40 : 1;
  const random = seededRandom(makeSeed(board, hand, waveIndex));
  const rollouts = Array.from({ length: sampleCount }, () => sampleCards(unseenPool, waveIndex === 0 ? 7 : waveIndex === 1 ? 3 : 0, random));
  const values = new Map<PlacementOption, number>();

  evaluatedOptions.forEach((option) => {
    if (waveIndex === 2) {
      values.set(option, evaluateBoard(option.board).total);
      return;
    }
    let total = 0;
    rollouts.forEach((rollout) => {
      if (waveIndex === 1) {
        total += bestFinalScore(option.board, rollout, 2);
        return;
      }
      const secondHand = rollout.slice(0, 4);
      const finalHand = rollout.slice(4, 7);
      const secondBoard = bestHeuristicBoard(option.board, secondHand, 3);
      total += bestFinalScore(secondBoard, finalHand, 2);
    });
    values.set(option, total / sampleCount);
  });

  const bestOption = evaluatedOptions.reduce((best, option) => (
    (values.get(option) ?? Number.NEGATIVE_INFINITY) > (values.get(best) ?? Number.NEGATIVE_INFINITY) ? option : best
  ));
  const bestExpected = values.get(bestOption) ?? 0;
  const discarded = hand.find((card) => !bestOption.usedIds.has(card.id)) ?? null;
  const discardOptions: PracticeDiscardOption[] = hand.map((card) => {
    const candidates = evaluatedOptions.filter((option) => !option.usedIds.has(card.id));
    const bestDiscardOption = candidates.reduce((best, option) => (
      (values.get(option) ?? Number.NEGATIVE_INFINITY) > (values.get(best) ?? Number.NEGATIVE_INFINITY) ? option : best
    ));
    const expectedScore = values.get(bestDiscardOption) ?? 0;
    return {
      card,
      expectedScore,
      gap: bestExpected - expectedScore,
      recommendation: bestDiscardOption.board,
    };
  }).sort((left, right) => right.expectedScore - left.expectedScore
    || Number(right.card.id === discarded?.id) - Number(left.card.id === discarded?.id));
  const cards: Record<string, PracticeCardValue> = {};
  hand.forEach((card) => {
    const playing = evaluatedOptions.filter((option) => option.usedIds.has(card.id));
    const discarding = evaluatedOptions.filter((option) => !option.usedIds.has(card.id));
    const playExpected = Math.max(...playing.map((option) => values.get(option) ?? 0));
    const discardExpected = discarding.length
      ? Math.max(...discarding.map((option) => values.get(option) ?? 0))
      : playExpected;
    let target: PracticeCardValue['target'] = null;
    bestOption.board.forEach((row, rowIndex) => row.forEach((placedCard, column) => {
      if (placedCard?.id === card.id && board[rowIndex][column] === null) target = { row: rowIndex, column };
    }));
    cards[card.id] = {
      playExpected,
      discardExpected,
      delta: playExpected - discardExpected,
      recommended: bestOption.usedIds.has(card.id),
      target,
    };
  });

  const finalBoards = waveIndex === 2 ? [bestOption.board] : rollouts.map((rollout) => {
    if (waveIndex === 1) return bestFinalOption(bestOption.board, rollout, 2).board;
    const secondBoard = bestHeuristicBoard(bestOption.board, rollout.slice(0, 4), 3);
    return bestFinalOption(secondBoard, rollout.slice(4, 7), 2).board;
  });
  const finalResults = finalBoards.map(evaluateBoard);
  const rowOutcomes = ROW_NAMES.map((_, rowIndex) => outcomeDistribution(
    finalResults.map((result) => TYPE_LABELS[result.rows[rowIndex].type]),
  ));
  const specialOutcomes = outcomeDistribution(finalResults.map((result) => result.topSpecial?.name ?? '无特殊牌型'));
  const validRate = finalResults.filter((result) => !result.bust).length / finalResults.length;

  return {
    recommendation: bestOption.board,
    expectedScore: bestExpected,
    samples: sampleCount,
    approximate: waveIndex < 2,
    cards,
    report: {
      discarded,
      reasons: buildPracticeReasons(board, hand, bestOption, discardOptions, validRate, rowOutcomes),
      discardOptions,
      rowOutcomes,
      specialOutcomes,
      validRate,
      unseenCount: unseenPool.length,
    },
  };
}

export function chooseAiBoard(board: Board, hand: Card[], placeCount: number): Board {
  const options = placementOptions(board, hand, placeCount);
  let bestBoard = cloneBoard(board);
  let bestValue = Number.NEGATIVE_INFINITY;
  options.forEach((option) => {
    const value = option.heuristic + Math.random() * 0.08;
    if (value > bestValue) {
      bestValue = value;
      bestBoard = option.board;
    }
  });
  return bestBoard;
}
