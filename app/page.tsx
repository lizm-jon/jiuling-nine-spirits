'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Board,
  BoardResult,
  Card,
  COLOR_NAMES,
  PracticeAnalysis,
  ROW_NAMES,
  ROW_SIZES,
  analyzePracticeMove,
  chooseAiBoard,
  classify,
  cloneBoard,
  compareStrength,
  createDeck,
  createEmptyBoard,
  createFullDeck,
  dealWave,
  evaluateBoard,
} from '../lib/game';

const AI_NAMES = ['玄鸦', '青岚', '白泽', '赤霄', '墨羽'];
const PLAYER_NAMES = ['你', ...AI_NAMES];
const WAVE_NAMES = ['第一波 · 壹', '第二波 · 贰', '第三波 · 叁'];
const DEAL_COUNTS = [4, 4, 3];
const PLACE_COUNTS = [3, 3, 2];
const ROW_HINTS = ['高牌 / 对子', '完整三张牌型', '牌力需最强'];

function CardFace({ card, compact = false, highlighted = false }: { card: Card; compact?: boolean; highlighted?: boolean }) {
  return (
    <span className={`card-face color-${card.color} ${compact ? 'is-compact' : ''} ${highlighted ? 'is-report-new' : ''}`}>
      <span className="corner">{card.number}<i>{COLOR_NAMES[card.color]}</i></span>
      <strong>{card.number}</strong>
      <span className="color-name">{COLOR_NAMES[card.color]}灵</span>
    </span>
  );
}

function MiniBoard({ board, highlightedIds = [] }: { board: Board; highlightedIds?: string[] }) {
  return (
    <div className="mini-board" aria-hidden="true">
      {board.map((row, rowIndex) => (
        <div className="mini-row" key={rowIndex}>
          {row.map((card, cardIndex) => (
            card ? <CardFace card={card} compact highlighted={highlightedIds.includes(card.id)} key={card.id} /> : <span className="mini-empty" key={cardIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

function TinyBoard({ board }: { board: Board }) {
  return (
    <span className="tiny-board" aria-hidden="true">
      {board.map((row, rowIndex) => (
        <span className="tiny-row" key={rowIndex}>
          {row.map((card, cardIndex) => (
            <i className={card ? `color-${card.color}` : ''} key={card?.id ?? cardIndex}>{card?.number ?? ''}</i>
          ))}
        </span>
      ))}
    </span>
  );
}

export default function Home() {
  const [started, setStarted] = useState(false);
  const [wave, setWave] = useState(0);
  const [deck, setDeck] = useState<Card[]>([]);
  const [boards, setBoards] = useState<Board[]>(() => Array.from({ length: 6 }, createEmptyBoard));
  const [hand, setHand] = useState<Card[]>([]);
  const [aiHands, setAiHands] = useState<Card[][]>([]);
  const [placedIds, setPlacedIds] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [results, setResults] = useState<BoardResult[] | null>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState(0);
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceAnalysis, setPracticeAnalysis] = useState<PracticeAnalysis | null>(null);
  const [analysisCardId, setAnalysisCardId] = useState<string | null>(null);
  const [waveStartBoard, setWaveStartBoard] = useState<Board>(createEmptyBoard);
  const [discardedIds, setDiscardedIds] = useState<string[]>([]);
  const [opponentPreview, setOpponentPreview] = useState<number | null>(null);
  const [practiceReportOpen, setPracticeReportOpen] = useState(false);

  const playerBoard = boards[0];
  const placeTarget = PLACE_COUNTS[wave];
  const placedCount = placedIds.length;
  const readyToConfirm = started && !processing && placedCount === placeTarget;

  const liveRows = useMemo(() => playerBoard.map((row, index) => {
    const cards = row.filter((card): card is Card => card !== null);
    return cards.length === row.length ? classify(cards, index === 0) : null;
  }), [playerBoard]);

  const liveBust = Boolean(
    (liveRows[0] && liveRows[1] && compareStrength(liveRows[1], liveRows[0]) < 0)
    || (liveRows[1] && liveRows[2] && compareStrength(liveRows[2], liveRows[1]) < 0),
  );

  const visibleHand = hand.filter((card) => !placedIds.includes(card.id));
  const analyzingPractice = practiceMode && started && !processing && !results && hand.length > 0 && practiceAnalysis === null;
  const practiceKnownKey = useMemo(() => [
    ...waveStartBoard.flat().filter((card): card is Card => card !== null).map((card) => card.id),
    ...boards.slice(1).flat(2).filter((card): card is Card => card !== null).map((card) => card.id),
    ...hand.map((card) => card.id),
    ...discardedIds,
  ].sort().join('|'), [boards, discardedIds, hand, waveStartBoard]);

  useEffect(() => {
    if (!practiceMode || !started || processing || results || !hand.length) return;
    const timer = window.setTimeout(() => {
      const knownIds = new Set<string>(practiceKnownKey ? practiceKnownKey.split('|') : []);
      const unseenPool = createFullDeck().filter((card) => !knownIds.has(card.id));
      const analysis = analyzePracticeMove(waveStartBoard, hand, unseenPool, wave);
      setPracticeAnalysis(analysis);
      setPracticeReportOpen(true);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [hand, practiceKnownKey, practiceMode, processing, results, started, wave, waveStartBoard]);

  function startGame(mode = practiceMode) {
    const freshBoards = Array.from({ length: 6 }, createEmptyBoard);
    const dealt = dealWave(createDeck(), DEAL_COUNTS[0]);
    setStarted(true);
    setWave(0);
    setDeck(dealt.deck);
    setBoards(freshBoards);
    setHand(dealt.hands[0]);
    setAiHands(dealt.hands.slice(1));
    setPlacedIds([]);
    setSelectedCardId(null);
    setProcessing(false);
    setResults(null);
    setInspectedPlayer(0);
    setPracticeMode(mode);
    setPracticeAnalysis(null);
    setAnalysisCardId(null);
    setWaveStartBoard(createEmptyBoard());
    setDiscardedIds([]);
    setOpponentPreview(null);
    setPracticeReportOpen(false);
  }

  function selectHandCard(card: Card) {
    if (processing) return;
    if (practiceMode) setAnalysisCardId(card.id);
    setSelectedCardId((current) => current === card.id ? null : card.id);
  }

  function clickBoardSlot(rowIndex: number, cardIndex: number) {
    if (!started || processing) return;
    const existing = playerBoard[rowIndex][cardIndex];
    if (existing) {
      if (!placedIds.includes(existing.id)) return;
      const nextBoards = [...boards];
      const nextPlayerBoard = cloneBoard(playerBoard);
      nextPlayerBoard[rowIndex][cardIndex] = null;
      nextBoards[0] = nextPlayerBoard;
      setBoards(nextBoards);
      setPlacedIds((current) => current.filter((id) => id !== existing.id));
      setSelectedCardId(existing.id);
      if (practiceMode) setAnalysisCardId(existing.id);
      return;
    }
    if (!selectedCardId || placedCount >= placeTarget) return;
    const selectedCard = hand.find((card) => card.id === selectedCardId);
    if (!selectedCard) return;
    const nextBoards = [...boards];
    const nextPlayerBoard = cloneBoard(playerBoard);
    nextPlayerBoard[rowIndex][cardIndex] = selectedCard;
    nextBoards[0] = nextPlayerBoard;
    setBoards(nextBoards);
    setPlacedIds((current) => [...current, selectedCard.id]);
    setSelectedCardId(null);
  }

  function confirmPlacement() {
    if (!readyToConfirm) return;
    setProcessing(true);
    setPracticeReportOpen(false);
    const currentBoards = boards.map(cloneBoard);
    const currentAiHands = aiHands.map((cards) => [...cards]);
    const currentWave = wave;
    const currentDeck = [...deck];
    const discardedThisWave = hand.filter((card) => !placedIds.includes(card.id)).map((card) => card.id);
    setDiscardedIds((current) => [...current, ...discardedThisWave]);

    window.setTimeout(() => {
      for (let aiIndex = 0; aiIndex < 5; aiIndex += 1) {
        currentBoards[aiIndex + 1] = chooseAiBoard(currentBoards[aiIndex + 1], currentAiHands[aiIndex], PLACE_COUNTS[currentWave]);
      }

      if (currentWave === 2) {
        setBoards(currentBoards);
        setResults(currentBoards.map(evaluateBoard));
        setInspectedPlayer(0);
        setProcessing(false);
        return;
      }

      const nextWave = currentWave + 1;
      const dealt = dealWave(currentDeck, DEAL_COUNTS[nextWave]);
      setBoards(currentBoards);
      setWave(nextWave);
      setWaveStartBoard(cloneBoard(currentBoards[0]));
      setDeck(dealt.deck);
      setHand(dealt.hands[0]);
      setAiHands(dealt.hands.slice(1));
      setPlacedIds([]);
      setSelectedCardId(null);
      setPracticeAnalysis(null);
      setAnalysisCardId(null);
      setProcessing(false);
    }, 560);
  }

  function applyPracticeRecommendation() {
    if (!practiceAnalysis) return;
    const nextBoards = [...boards];
    nextBoards[0] = cloneBoard(practiceAnalysis.recommendation);
    const previousIds = new Set(waveStartBoard.flat().filter((card): card is Card => card !== null).map((card) => card.id));
    const recommendedIds = practiceAnalysis.recommendation
      .flat()
      .filter((card): card is Card => Boolean(card && !previousIds.has(card.id)))
      .map((card) => card.id);
    setBoards(nextBoards);
    setPlacedIds(recommendedIds);
    setSelectedCardId(null);
    setAnalysisCardId(practiceAnalysis.report.discarded?.id ?? null);
    setPracticeReportOpen(false);
  }

  const ranking = useMemo(() => {
    if (!results) return [];
    return results
      .map((result, player) => ({ result, player, rank: 1 + results.filter((other) => other.total > result.total).length }))
      .sort((a, b) => b.result.total - a.result.total || a.player - b.player);
  }, [results]);

  const selectedResult = results?.[inspectedPlayer] ?? null;
  const selectedPracticeCard = analysisCardId ? hand.find((card) => card.id === analysisCardId) ?? null : null;
  const selectedPracticeValue = selectedPracticeCard && practiceAnalysis ? practiceAnalysis.cards[selectedPracticeCard.id] : null;
  const publicOpponentCards = opponentPreview ? boards[opponentPreview].flat().filter(Boolean).length : 0;
  const totalPublicOpponentCards = boards.slice(1).flat(2).filter(Boolean).length;
  const recommendedPracticeIds = practiceAnalysis?.recommendation
    .flat()
    .filter((card): card is Card => Boolean(card && !waveStartBoard.flat().some((previousCard) => previousCard?.id === card.id)))
    .map((card) => card.id) ?? [];
  const winnerText = results
    ? results[0].total === Math.max(...results.map((result) => result.total))
      ? results.filter((result) => result.total === results[0].total).length > 1 ? '并列第一' : '你赢了'
      : `本局第 ${1 + results.filter((result) => result.total > results[0].total).length} 名`
    : '';

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => startGame(practiceMode)} aria-label="开始一局新游戏">
          <span className="brand-mark">九</span>
          <span><strong>九灵牌</strong><small>NINE SPIRITS</small></span>
        </button>
        <div className="top-actions">
          <div className="mode-switch" role="group" aria-label="游戏模式">
            <button type="button" aria-pressed={!practiceMode} onClick={() => { setPracticeAnalysis(null); setPracticeReportOpen(false); setPracticeMode(false); }}>普通</button>
            <button type="button" aria-pressed={practiceMode} onClick={() => { setPracticeAnalysis(null); setPracticeReportOpen(false); setPracticeMode(true); }}>练习</button>
          </div>
          <button className="text-button" type="button" onClick={() => setRulesOpen(true)}>玩法规则</button>
          <button className="new-game-button" type="button" onClick={() => startGame(practiceMode)} disabled={processing}>
            {started ? '重新开局' : '开始牌局'}
          </button>
        </div>
      </header>

      <section className="table-wrap" aria-label="九灵牌牌桌">
        <aside className="opponents" aria-label="五位对手">
          {AI_NAMES.map((name, index) => (
            <button
              className="opponent"
              key={name}
              type="button"
              onClick={() => setOpponentPreview(index + 1)}
              disabled={!started || wave === 0 || processing}
              aria-label={`${name}${wave > 0 ? `截至上一轮已公开 ${boards[index + 1].flat().filter(Boolean).length} 张，点击查看` : '尚无公开牌阵'}`}
            >
              <span className={`avatar avatar-${index + 1}`}>{name[0]}</span>
              <span>
                <strong>{name}</strong>
                <small>{results ? `${results[index + 1].total} 分` : processing ? '推演牌阵中' : started && wave > 0 ? `公开 ${boards[index + 1].flat().filter(Boolean).length} 张` : started ? '等待第一波' : '等待开局'}</small>
              </span>
              {started && wave > 0 ? <TinyBoard board={boards[index + 1]} /> : <i className={`ready-dot ${processing ? 'is-thinking' : ''}`} />}
            </button>
          ))}
        </aside>

        <section className="play-area">
          <div className="round-heading">
            <div>
              <p className="eyebrow">{started ? WAVE_NAMES[wave] : '六人牌局 · 三波成阵'}{practiceMode && <span className="practice-chip">练习模式</span>}</p>
              <h1>{started ? (processing ? '灵阵推演中…' : `选 ${placeTarget} 张，落入牌阵`) : '八张成阵，强弱有序'}</h1>
              <p>{started ? `点选手牌，再选择空位；本波会弃掉 ${DEAL_COUNTS[wave] - PLACE_COUNTS[wave]} 张。` : '把牌摆成上二、中三、下三；牌力必须逐行增强。'}</p>
            </div>
            <div className="round-meter" aria-label={started ? `第 ${wave + 1} 波，共三波` : '等待开局'}>
              <b>{started ? String(wave + 1).padStart(2, '0') : '—'}</b><span>/ 03</span>
            </div>
          </div>

          {started && wave > 0 && !results && (
            <button className="opponent-reveal-button" type="button" onClick={() => setOpponentPreview(1)}>
              查看五家上一轮牌阵 <span>公开 {wave * 3} 张起</span>
            </button>
          )}

          <div className={`board-card ${liveBust ? 'has-warning' : ''}`}>
            <div className="board-glow" />
            {ROW_SIZES.map((size, rowIndex) => (
              <div className="board-row" key={ROW_NAMES[rowIndex]}>
                <div className="row-label">
                  <strong>{ROW_NAMES[rowIndex]}</strong>
                  <span>{ROW_HINTS[rowIndex]}</span>
                </div>
                <div className={`slots slots-${size}`}>
                  {playerBoard[rowIndex].map((card, cardIndex) => {
                    const recommendedCard = practiceAnalysis && !waveStartBoard[rowIndex][cardIndex]
                      ? practiceAnalysis.recommendation[rowIndex][cardIndex]
                      : null;
                    const recommendationMatched = Boolean(card && recommendedCard?.id === card.id);
                    return (
                      <button
                        className={`card-slot ${card ? 'is-filled' : ''} ${card && placedIds.includes(card.id) ? 'is-new' : ''} ${!card && selectedCardId ? 'is-target' : ''} ${recommendationMatched ? 'is-recommended-match' : ''}`}
                        type="button"
                        key={card?.id ?? `${rowIndex}-${cardIndex}`}
                        onClick={() => clickBoardSlot(rowIndex, cardIndex)}
                        aria-label={card ? `${ROW_NAMES[rowIndex]} ${COLOR_NAMES[card.color]}色 ${card.number}，点击撤回` : recommendedCard ? `${ROW_NAMES[rowIndex]}空位 ${cardIndex + 1}，练习建议放 ${COLOR_NAMES[recommendedCard.color]}色 ${recommendedCard.number}` : `${ROW_NAMES[rowIndex]}空位 ${cardIndex + 1}`}
                      >
                        {card ? <CardFace card={card} /> : recommendedCard ? (
                          <span className={`recommendation-ghost color-${recommendedCard.color}`}><b>{recommendedCard.number}</b><small>推荐 · {COLOR_NAMES[recommendedCard.color]}</small></span>
                        ) : <span className="slot-plus">+</span>}
                        {recommendationMatched && <span className="match-badge">最优位</span>}
                      </button>
                    );
                  })}
                </div>
                <span className={`row-score ${liveRows[rowIndex] ? 'is-scored' : ''}`}>
                  {liveRows[rowIndex] ? <><b>{liveRows[rowIndex]!.score}</b><small>{liveRows[rowIndex]!.label}</small></> : '—'}
                </span>
              </div>
            ))}

            {!started && (
              <div className="start-panel">
                <p className="eyebrow">一局约 3 分钟</p>
                <h2>布下你的九灵牌阵</h2>
                <p>三波发牌，逐步取舍。和五位 AI 一较高下。</p>
                <div className="start-actions">
                  <button className="primary-button start-button" type="button" onClick={() => startGame(false)}>普通模式</button>
                  <button className="practice-start-button" type="button" onClick={() => startGame(true)}><span>◇</span>练习模式 · 显示最优解</button>
                </div>
              </div>
            )}

            {liveBust && <div className="bust-warning" role="status">当前牌序会炸牌：请让下行 ≥ 中行 ≥ 上行</div>}
            {processing && <div className="thinking-shade" role="status"><span className="thinking-orb" />五位对手正在摆牌</div>}
          </div>
        </section>

        <aside className="score-guide">
          <p className="eyebrow">牌型分值</p>
          {[['同色顺', '10'], ['同色', '7'], ['三条', '5'], ['顺子', '3'], ['对子', '2']].map(([name, score]) => (
            <div className="guide-row" key={name}><span>{name}</span><strong>{score}</strong></div>
          ))}
          <p className="guide-note">下行 ≥ 中行 ≥ 上行<br />否则基础分为 0</p>
          <button className="guide-link" type="button" onClick={() => setRulesOpen(true)}>查看特殊牌型 →</button>
        </aside>
      </section>

      {started && !results && (
        <section className={`hand-dock ${practiceMode ? 'practice-dock' : ''}`} aria-label="你的手牌">
          <div className={`hand-copy ${practiceMode ? 'practice-copy' : ''}`}>
            <span className="player-token">你</span>
            {practiceMode ? (
              <div className="practice-summary" aria-live="polite">
                <strong>{analyzingPractice ? '正在推演最优解…' : selectedPracticeCard && selectedPracticeValue ? `${COLOR_NAMES[selectedPracticeCard.color]} ${selectedPracticeCard.number} · 选牌分析` : '本轮模拟最优'}</strong>
                {analyzingPractice ? <small>比较各种摆法与后续发牌</small> : selectedPracticeValue ? (
                  <small><b>{selectedPracticeValue.playExpected.toFixed(1)}</b> 分期望 · {selectedPracticeValue.delta >= 0 ? `比弃置高 ${selectedPracticeValue.delta.toFixed(1)}` : `弃置更高 ${Math.abs(selectedPracticeValue.delta).toFixed(1)}`}</small>
                ) : practiceAnalysis ? <small><b>{practiceAnalysis.expectedScore.toFixed(1)}</b> 分 · {practiceAnalysis.approximate ? `${practiceAnalysis.samples} 组后续发牌模拟` : '最终波精确计算'}</small> : <small>准备分析当前牌阵</small>}
                {practiceAnalysis && <button className="report-link" type="button" onClick={() => setPracticeReportOpen(true)}>查看本手完整报告 →</button>}
              </div>
            ) : (
              <div>
                <strong>你的手牌</strong>
                <small>{readyToConfirm ? `将弃掉 ${visibleHand.length} 张` : `尚需放置 ${placeTarget - placedCount} 张`}</small>
              </div>
            )}
          </div>
          <div className="hand-cards">
            {visibleHand.map((card) => {
              const cardAnalysis = practiceAnalysis?.cards[card.id];
              return (
                <button
                  className={`playing-card ${selectedCardId === card.id ? 'is-selected' : ''} ${readyToConfirm ? 'will-discard' : ''} ${cardAnalysis?.recommended ? 'is-recommended' : ''}`}
                  type="button"
                  key={card.id}
                  onClick={() => selectHandCard(card)}
                  aria-pressed={selectedCardId === card.id}
                  aria-label={`${COLOR_NAMES[card.color]}色 ${card.number}${cardAnalysis ? `，选择期望 ${cardAnalysis.playExpected.toFixed(1)} 分` : ''}${readyToConfirm ? '，确认后弃掉' : ''}`}
                >
                  <CardFace card={card} />
                  {cardAnalysis && <span className={`analysis-badge ${cardAnalysis.recommended ? 'is-best' : ''}`}>{cardAnalysis.recommended ? '推荐' : '可弃'}</span>}
                  {readyToConfirm && <span className="discard-tag">将弃</span>}
                </button>
              );
            })}
            {!visibleHand.length && <span className="hand-empty">三张牌已落位</span>}
          </div>
          <button className="primary-button" type="button" disabled={!readyToConfirm} onClick={confirmPlacement}>
            {processing ? '推演中…' : wave === 2 ? '完成牌阵' : '确认摆牌'}
          </button>
        </section>
      )}

      {practiceReportOpen && practiceAnalysis && practiceMode && started && !results && (
        <div className="modal-backdrop report-backdrop" role="presentation" onMouseDown={() => setPracticeReportOpen(false)}>
          <section className="practice-report-modal" role="dialog" aria-modal="true" aria-labelledby="practice-report-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header report-header">
              <div>
                <p className="eyebrow">{WAVE_NAMES[wave]} · 发牌完成</p>
                <h2 id="practice-report-title">这一手为什么这样摆</h2>
                <p>已比较每一种弃牌选择，并用当前可见信息推演最终牌阵。</p>
              </div>
              <button className="close-button" type="button" onClick={() => setPracticeReportOpen(false)} aria-label="关闭本手分析报告">×</button>
            </div>

            <div className="report-metrics">
              <div><span>最优期望</span><strong>{practiceAnalysis.expectedScore.toFixed(1)}</strong><small>最终得分</small></div>
              <div><span>不炸牌率</span><strong>{(practiceAnalysis.report.validRate * 100).toFixed(0)}%</strong><small>最优路线</small></div>
              <div><span>计算范围</span><strong>{practiceAnalysis.approximate ? practiceAnalysis.samples : '精确'}</strong><small>{practiceAnalysis.approximate ? '组未知发牌' : '全部落位'}</small></div>
              <div><span>公开信息</span><strong>{totalPublicOpponentCards}</strong><small>张对手牌</small></div>
            </div>

            <div className="report-decision-grid">
              <article className="recommended-layout">
                <div className="report-section-heading">
                  <div><p className="eyebrow">推荐结论</p><h3>最优落位</h3></div>
                  {practiceAnalysis.report.discarded && <span className="discard-summary">弃 {COLOR_NAMES[practiceAnalysis.report.discarded.color]} {practiceAnalysis.report.discarded.number}</span>}
                </div>
                <MiniBoard board={practiceAnalysis.recommendation} highlightedIds={recommendedPracticeIds} />
                <p>金色描边是本手推荐牌，虚线空位留给后续波次。当前未知牌池共 {practiceAnalysis.report.unseenCount} 张。</p>
              </article>

              <article className="reason-card">
                <p className="eyebrow">决策解释</p>
                <h3>为什么它是最优解</h3>
                <ol>
                  {practiceAnalysis.report.reasons.map((reason, index) => <li key={`${index}-${reason}`}>{reason}</li>)}
                </ol>
              </article>
            </div>

            <section className="outcome-section">
              <div className="report-section-heading">
                <div><p className="eyebrow">成牌路线</p><h3>最终可能形成什么牌</h3></div>
                <small>{practiceAnalysis.approximate ? '百分比来自未知后续发牌模拟' : '第三波为当前牌面的确定结果'}</small>
              </div>
              <div className="outcome-grid">
                {practiceAnalysis.report.rowOutcomes.map((outcomes, rowIndex) => (
                  <div className="outcome-card" key={ROW_NAMES[rowIndex]}>
                    <strong>{ROW_NAMES[rowIndex]}</strong>
                    <div>{outcomes.map((outcome) => <span key={outcome.label}>{outcome.label}<b>{(outcome.probability * 100).toFixed(0)}%</b></span>)}</div>
                  </div>
                ))}
                <div className="outcome-card special-outcomes">
                  <strong>特殊牌型</strong>
                  <div>{practiceAnalysis.report.specialOutcomes.map((outcome) => <span key={outcome.label}>{outcome.label}<b>{(outcome.probability * 100).toFixed(0)}%</b></span>)}</div>
                </div>
              </div>
            </section>

            <section className="discard-comparison">
              <div className="report-section-heading">
                <div><p className="eyebrow">完整比较</p><h3>分别弃掉每张牌，会怎样</h3></div>
                <small>每一行都取该弃牌选择下的最佳落位</small>
              </div>
              <div className="discard-option-list">
                {practiceAnalysis.report.discardOptions.map((option) => {
                  const isRecommendedDiscard = option.card.id === practiceAnalysis.report.discarded?.id;
                  return (
                    <div className={`discard-option ${isRecommendedDiscard ? 'is-best' : ''}`} key={option.card.id}>
                      <span className={`discard-card color-${option.card.color}`}><b>{option.card.number}</b><small>{COLOR_NAMES[option.card.color]}灵</small></span>
                      <span className="discard-option-copy"><strong>{isRecommendedDiscard ? '推荐弃牌' : `弃掉 ${COLOR_NAMES[option.card.color]} ${option.card.number}`}</strong><small>{option.gap < 0.05 ? '当前最优' : `比最优少 ${option.gap.toFixed(1)} 分`}</small></span>
                      <TinyBoard board={option.recommendation} />
                      <b className="option-score">{option.expectedScore.toFixed(1)}<small>分期望</small></b>
                    </div>
                  );
                })}
              </div>
            </section>

            <div className="report-actions">
              <button className="text-button" type="button" onClick={() => setPracticeReportOpen(false)}>自己尝试</button>
              <button className="primary-button apply-recommendation" type="button" onClick={applyPracticeRecommendation}>按最优解摆放</button>
            </div>
          </section>
        </div>
      )}

      {opponentPreview && started && wave > 0 && !results && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setOpponentPreview(null)}>
          <section className="opponent-modal" role="dialog" aria-modal="true" aria-labelledby="opponent-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">公开信息 · 上一轮结果</p>
                <h2 id="opponent-title">五家牌阵</h2>
              </div>
              <button className="close-button" type="button" onClick={() => setOpponentPreview(null)} aria-label="关闭对手牌阵">×</button>
            </div>
            <div className="opponent-tabs" role="tablist" aria-label="选择对手">
              {AI_NAMES.map((name, index) => (
                <button className={opponentPreview === index + 1 ? 'is-active' : ''} type="button" role="tab" aria-selected={opponentPreview === index + 1} key={name} onClick={() => setOpponentPreview(index + 1)}>
                  <span className={`avatar avatar-${index + 1}`}>{name[0]}</span>{name}
                </button>
              ))}
            </div>
            <div className="opponent-inspect">
              <div>
                <p className="eyebrow">{AI_NAMES[opponentPreview - 1]}</p>
                <h3>截至上一轮已公开 {publicOpponentCards} / 8 张</h3>
                <p>这些牌在本轮开始前已经公开，可用于判断剩余颜色、数字与对手牌力。</p>
              </div>
              <MiniBoard board={boards[opponentPreview]} />
            </div>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setRulesOpen(false)}>
          <section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div><p className="eyebrow">完整玩法</p><h2 id="rules-title">九灵牌规则</h2></div>
              <button className="close-button" type="button" onClick={() => setRulesOpen(false)} aria-label="关闭规则">×</button>
            </div>
            <div className="rules-grid">
              <article>
                <h3>三波成阵</h3>
                <p>第一波与第二波各发 4 张：选 3 张摆下，弃 1 张。第三波发 3 张：选 2 张填满，弃 1 张。</p>
                <div className="formation"><span>上行 · 2 张</span><span>中行 · 3 张</span><span>下行 · 3 张</span></div>
              </article>
              <article>
                <h3>牌力与炸牌</h3>
                <p>牌力顺序：高牌 ＜ 对子 ＜ 顺子 ＜ 三条 ＜ 同色 ＜ 同色顺。必须满足下行 ≥ 中行 ≥ 上行，否则基础分归零。</p>
                <p className="fine-print">同牌型时：对子比对数；顺子比最大牌；同色与高牌从最大数字起依次比较。</p>
              </article>
              <article>
                <h3>公开信息与练习</h3>
                <p>每一波结束后，五位对手刚摆下的牌都会公开。练习模式每次发牌后会自动生成报告，比较所有弃牌方案、成牌路线与炸牌风险；点击手牌仍可单独查看得分期望。</p>
                <p className="fine-print">前两波为多组随机后续发牌的模拟期望；第三波因没有未知发牌，为精确最优解。</p>
              </article>
            </div>
            <h3 className="section-title">特殊牌型 · 无视炸牌，和基础分取最高</h3>
            <div className="special-grid">
              {[
                ['异色', '7', '8 张颜色全不同'], ['四对', '10', '所有数字成双出现'],
                ['全单', '10', '8 张全是单数'], ['全双', '10', '8 张全是双数'],
                ['三蛇', '10', '三行数字都连续'], ['龙', '15', '三行依次组成 1–8 或 2–9'],
                ['异龙', '20', '龙 + 8 张颜色全不同'], ['青龙', '35', '龙 + 每一行内部同色'],
              ].map(([name, score, desc]) => (
                <div className="special-card" key={name}><b>{score}</b><span><strong>{name}</strong><small>{desc}</small></span></div>
              ))}
            </div>
            <button className="primary-button modal-action" type="button" onClick={() => setRulesOpen(false)}>明白了</button>
          </section>
        </div>
      )}

      {results && selectedResult && (
        <div className="modal-backdrop result-backdrop">
          <section className="result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div className="result-hero">
              <div>
                <p className="eyebrow">牌局结算</p>
                <h2 id="result-title">{winnerText}</h2>
                <p>点击排名，可以查看每位玩家的完整牌阵。</p>
              </div>
              <div className="hero-score"><strong>{results[0].total}</strong><span>你的得分</span></div>
            </div>

            <div className="result-layout">
              <div className="ranking-list" aria-label="本局排名">
                {ranking.map(({ player, result, rank }) => (
                  <button className={`rank-row ${inspectedPlayer === player ? 'is-active' : ''} ${player === 0 ? 'is-you' : ''}`} type="button" key={PLAYER_NAMES[player]} onClick={() => setInspectedPlayer(player)}>
                    <span className="rank-number">{rank}</span>
                    <span className={`avatar avatar-${player || 1}`}>{PLAYER_NAMES[player][0]}</span>
                    <span className="rank-name"><strong>{PLAYER_NAMES[player]}</strong><small>{result.topSpecial?.name ?? (result.bust ? '炸牌' : '普通牌型')}</small></span>
                    <b>{result.total}<small>分</small></b>
                  </button>
                ))}
              </div>

              <div className="inspect-board">
                <div className="inspect-title">
                  <div><p className="eyebrow">{PLAYER_NAMES[inspectedPlayer]}的牌阵</p><h3>{selectedResult.topSpecial?.name ?? (selectedResult.bust ? '基础牌炸牌' : '基础牌成立')}</h3></div>
                  <span className={selectedResult.bust ? 'bust-pill' : 'valid-pill'}>{selectedResult.bust ? '炸牌' : '成立'}</span>
                </div>
                <MiniBoard board={boards[inspectedPlayer]} />
                <div className="score-breakdown">
                  {selectedResult.rows.map((row, index) => (
                    <div key={ROW_NAMES[index]}><span>{ROW_NAMES[index]} · {row.label}</span><b>{row.score}</b></div>
                  ))}
                  <div><span>基础分{selectedResult.bust ? '（炸牌归零）' : ''}</span><b>{selectedResult.baseScore}</b></div>
                  {selectedResult.topSpecial && <div className="special-total"><span>特殊 · {selectedResult.topSpecial.name}</span><b>{selectedResult.topSpecial.score}</b></div>}
                  <div className="final-total"><span>最终取最高</span><b>{selectedResult.total} 分</b></div>
                </div>
              </div>
            </div>
            <div className="result-actions">
              <button className="text-button" type="button" onClick={() => setRulesOpen(true)}>回看规则</button>
              <button className="primary-button play-again" type="button" onClick={() => startGame(practiceMode)}>再来一局</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
