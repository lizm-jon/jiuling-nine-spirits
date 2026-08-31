'use client';

import { useMemo, useState } from 'react';
import {
  Board,
  BoardResult,
  Card,
  COLOR_NAMES,
  ROW_NAMES,
  ROW_SIZES,
  chooseAiBoard,
  classify,
  cloneBoard,
  compareStrength,
  createDeck,
  createEmptyBoard,
  dealWave,
  evaluateBoard,
} from '../lib/game';

const AI_NAMES = ['玄鸦', '青岚', '白泽', '赤霄', '墨羽'];
const PLAYER_NAMES = ['你', ...AI_NAMES];
const WAVE_NAMES = ['第一波 · 壹', '第二波 · 贰', '第三波 · 叁'];
const DEAL_COUNTS = [4, 4, 3];
const PLACE_COUNTS = [3, 3, 2];
const ROW_HINTS = ['高牌 / 对子', '完整三张牌型', '牌力需最强'];

function CardFace({ card, compact = false }: { card: Card; compact?: boolean }) {
  return (
    <span className={`card-face color-${card.color} ${compact ? 'is-compact' : ''}`}>
      <span className="corner">{card.number}<i>{COLOR_NAMES[card.color]}</i></span>
      <strong>{card.number}</strong>
      <span className="color-name">{COLOR_NAMES[card.color]}灵</span>
    </span>
  );
}

function MiniBoard({ board }: { board: Board }) {
  return (
    <div className="mini-board" aria-hidden="true">
      {board.map((row, rowIndex) => (
        <div className="mini-row" key={rowIndex}>
          {row.map((card, cardIndex) => (
            card ? <CardFace card={card} compact key={card.id} /> : <span className="mini-empty" key={cardIndex} />
          ))}
        </div>
      ))}
    </div>
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

  function startGame() {
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
  }

  function selectHandCard(card: Card) {
    if (processing) return;
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
    const currentBoards = boards.map(cloneBoard);
    const currentAiHands = aiHands.map((cards) => [...cards]);
    const currentWave = wave;
    const currentDeck = [...deck];

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
      setDeck(dealt.deck);
      setHand(dealt.hands[0]);
      setAiHands(dealt.hands.slice(1));
      setPlacedIds([]);
      setSelectedCardId(null);
      setProcessing(false);
    }, 560);
  }

  const ranking = useMemo(() => {
    if (!results) return [];
    return results
      .map((result, player) => ({ result, player, rank: 1 + results.filter((other) => other.total > result.total).length }))
      .sort((a, b) => b.result.total - a.result.total || a.player - b.player);
  }, [results]);

  const selectedResult = results?.[inspectedPlayer] ?? null;
  const winnerText = results
    ? results[0].total === Math.max(...results.map((result) => result.total))
      ? results.filter((result) => result.total === results[0].total).length > 1 ? '并列第一' : '你赢了'
      : `本局第 ${1 + results.filter((result) => result.total > results[0].total).length} 名`
    : '';

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={startGame} aria-label="开始一局新游戏">
          <span className="brand-mark">九</span>
          <span><strong>九灵牌</strong><small>NINE SPIRITS</small></span>
        </button>
        <div className="top-actions">
          <button className="text-button" type="button" onClick={() => setRulesOpen(true)}>玩法规则</button>
          <button className="new-game-button" type="button" onClick={startGame} disabled={processing}>
            {started ? '重新开局' : '开始牌局'}
          </button>
        </div>
      </header>

      <section className="table-wrap" aria-label="九灵牌牌桌">
        <aside className="opponents" aria-label="五位对手">
          {AI_NAMES.map((name, index) => (
            <div className="opponent" key={name}>
              <span className={`avatar avatar-${index + 1}`}>{name[0]}</span>
              <span>
                <strong>{name}</strong>
                <small>{results ? `${results[index + 1].total} 分` : processing ? '推演牌阵中' : started ? `已完成 ${wave} 波` : '等待开局'}</small>
              </span>
              <i className={`ready-dot ${processing ? 'is-thinking' : ''}`} />
            </div>
          ))}
        </aside>

        <section className="play-area">
          <div className="round-heading">
            <div>
              <p className="eyebrow">{started ? WAVE_NAMES[wave] : '六人牌局 · 三波成阵'}</p>
              <h1>{started ? (processing ? '灵阵推演中…' : `选 ${placeTarget} 张，落入牌阵`) : '八张成阵，强弱有序'}</h1>
              <p>{started ? `点选手牌，再选择空位；本波会弃掉 ${DEAL_COUNTS[wave] - PLACE_COUNTS[wave]} 张。` : '把牌摆成上二、中三、下三；牌力必须逐行增强。'}</p>
            </div>
            <div className="round-meter" aria-label={started ? `第 ${wave + 1} 波，共三波` : '等待开局'}>
              <b>{started ? String(wave + 1).padStart(2, '0') : '—'}</b><span>/ 03</span>
            </div>
          </div>

          <div className={`board-card ${liveBust ? 'has-warning' : ''}`}>
            <div className="board-glow" />
            {ROW_SIZES.map((size, rowIndex) => (
              <div className="board-row" key={ROW_NAMES[rowIndex]}>
                <div className="row-label">
                  <strong>{ROW_NAMES[rowIndex]}</strong>
                  <span>{ROW_HINTS[rowIndex]}</span>
                </div>
                <div className={`slots slots-${size}`}>
                  {playerBoard[rowIndex].map((card, cardIndex) => (
                    <button
                      className={`card-slot ${card ? 'is-filled' : ''} ${card && placedIds.includes(card.id) ? 'is-new' : ''} ${!card && selectedCardId ? 'is-target' : ''}`}
                      type="button"
                      key={card?.id ?? `${rowIndex}-${cardIndex}`}
                      onClick={() => clickBoardSlot(rowIndex, cardIndex)}
                      aria-label={card ? `${ROW_NAMES[rowIndex]} ${COLOR_NAMES[card.color]}色 ${card.number}，点击撤回` : `${ROW_NAMES[rowIndex]}空位 ${cardIndex + 1}`}
                    >
                      {card ? <CardFace card={card} /> : <span className="slot-plus">+</span>}
                    </button>
                  ))}
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
                <button className="primary-button start-button" type="button" onClick={startGame}>开始一局</button>
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
        <section className="hand-dock" aria-label="你的手牌">
          <div className="hand-copy">
            <span className="player-token">你</span>
            <div>
              <strong>你的手牌</strong>
              <small>{readyToConfirm ? `将弃掉 ${visibleHand.length} 张` : `尚需放置 ${placeTarget - placedCount} 张`}</small>
            </div>
          </div>
          <div className="hand-cards">
            {visibleHand.map((card) => (
              <button
                className={`playing-card ${selectedCardId === card.id ? 'is-selected' : ''} ${readyToConfirm ? 'will-discard' : ''}`}
                type="button"
                key={card.id}
                onClick={() => selectHandCard(card)}
                aria-pressed={selectedCardId === card.id}
                aria-label={`${COLOR_NAMES[card.color]}色 ${card.number}${readyToConfirm ? '，确认后弃掉' : ''}`}
              >
                <CardFace card={card} />
                {readyToConfirm && <span className="discard-tag">将弃</span>}
              </button>
            ))}
            {!visibleHand.length && <span className="hand-empty">三张牌已落位</span>}
          </div>
          <button className="primary-button" type="button" disabled={!readyToConfirm} onClick={confirmPlacement}>
            {processing ? '推演中…' : wave === 2 ? '完成牌阵' : '确认摆牌'}
          </button>
        </section>
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
              <button className="primary-button play-again" type="button" onClick={startGame}>再来一局</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
