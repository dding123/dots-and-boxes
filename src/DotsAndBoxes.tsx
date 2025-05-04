import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, HelpCircle, Crown } from 'lucide-react';

interface Line {
  row: number;
  col: number;
  isHorizontal: boolean;
  player: number | null;
}

interface Box {
  row: number;
  col: number;
  owner: number | null;
}

const GRID_SIZE = 4; // 4x4 grid of boxes (5x5 grid of dots)
const PLAYER_COLORS = ['#3B82F6', '#EF4444']; // Blue for Player 1, Red for Player 2/Computer
const ANIMATION_DURATION = 0.3;
const COMPUTER_DELAY = 1000;

const commonStyles = {
  border: 'border border-[#375b73]',
  rounded: 'rounded-xl',
  textColor: 'text-[#eae4af]',
  bgColor: 'bg-[#001B4D]/30',
};

const DotsAndBoxes: React.FC = () => {
  const [gameState, setGameState] = useState({
    gameMode: 'pvp' as 'pvp' | 'vsComputer',
    currentPlayer: 0,
    lines: [] as Line[],
    boxes: [] as Box[],
    scores: [0, 0],
    showHowToPlay: true,
    gameOver: false,
    isComputerThinking: false,
    showGameOverModal: false,
    gameKey: 0,
  });

  // Use a single ref for game state
  const gameStateRef = useRef(gameState);

  // Update ref when state changes
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Optimize state updates
  const updateGameState = (updates: Partial<typeof gameState>) => {
    setGameState(prev => ({ ...prev, ...updates }));
  };

  // Optimize game initialization
  const initializeGame = () => {
    const newLines: Line[] = [];
    const newBoxes: Box[] = [];

    // Initialize lines and boxes in a single loop
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        if (row < GRID_SIZE && col < GRID_SIZE) {
          newBoxes.push({ row, col, owner: null });
        }
        if (col < GRID_SIZE) {
          newLines.push({
            row: row * 2,
            col: col * 2 + 1,
            isHorizontal: true,
            player: null
          });
        }
        if (row < GRID_SIZE) {
          newLines.push({
            row: row * 2 + 1,
            col: col * 2,
            isHorizontal: false,
            player: null
          });
        }
      }
    }

    updateGameState({
      lines: newLines,
      boxes: newBoxes,
      scores: [0, 0],
      currentPlayer: 0,
      gameOver: false,
      isComputerThinking: false,
    });
  };

  // Initialize game on mount
  useEffect(() => {
    initializeGame();
  }, []);

  const resetGame = () => {
    // Cancel any pending computer moves
    setGameState(prev => ({ ...prev, isComputerThinking: false, gameOver: false, showGameOverModal: false, gameKey: prev.gameKey + 1 }));
    initializeGame();
  };

  const handleGameModeChange = (newMode: 'pvp' | 'vsComputer') => {
    setGameState(prev => ({ ...prev, gameMode: newMode, gameKey: prev.gameKey + 1 }));
    resetGame();
  };

  const checkForCompletedBoxes = (currentLines: Line[]): Box[] => {
    const completedBoxes: Box[] = [];
    gameState.boxes.forEach((box) => {
      if (box.owner !== null) return;

      const boxLines = {
        top: currentLines.find(
          (l) => l.row === box.row * 2 && l.col === box.col * 2 + 1 && l.isHorizontal
        ),
        bottom: currentLines.find(
          (l) => l.row === (box.row + 1) * 2 && l.col === box.col * 2 + 1 && l.isHorizontal
        ),
        left: currentLines.find(
          (l) => l.row === box.row * 2 + 1 && l.col === box.col * 2 && !l.isHorizontal
        ),
        right: currentLines.find(
          (l) => l.row === box.row * 2 + 1 && l.col === (box.col + 1) * 2 && !l.isHorizontal
        )
      };

      if (boxLines.top?.player !== null && 
          boxLines.bottom?.player !== null && 
          boxLines.left?.player !== null && 
          boxLines.right?.player !== null) {
        completedBoxes.push(box);
      }
    });
    return completedBoxes;
  };

  const handleLineClick = (line: Line) => {
    if (line.player !== null || gameState.gameOver || gameState.isComputerThinking) return;
    if (gameState.gameMode === 'vsComputer' && gameState.currentPlayer !== 0) return;

    const currentState = gameStateRef.current;
    const newLines = [...currentState.lines];
    const lineIndex = newLines.findIndex(
      (l) => l.row === line.row && l.col === line.col && l.isHorizontal === line.isHorizontal
    );
    
    if (lineIndex === -1) return;

    newLines[lineIndex] = { ...line, player: currentState.currentPlayer };
    
    const completedBoxes = checkForCompletedBoxes(newLines);
    if (completedBoxes.length > 0) {
      const newBoxes = [...currentState.boxes];
      const newScores = [...currentState.scores];
      
      completedBoxes.forEach((box) => {
        const boxIndex = newBoxes.findIndex((b) => b.row === box.row && b.col === box.col);
        if (boxIndex !== -1 && newBoxes[boxIndex].owner === null) {
          newBoxes[boxIndex] = { ...box, owner: currentState.currentPlayer };
          newScores[currentState.currentPlayer]++;
        }
      });

      const totalBoxes = GRID_SIZE * GRID_SIZE;
      const filledBoxes = newScores[0] + newScores[1];
      const isGameOver = filledBoxes === totalBoxes;

      // Update state with completed boxes
      updateGameState({
        lines: newLines,
        boxes: newBoxes,
        scores: newScores,
        currentPlayer: currentState.currentPlayer, // Keep the same player's turn
        gameOver: isGameOver,
        showGameOverModal: isGameOver,
        isComputerThinking: false
      });

      if (isGameOver) return;

      // If playing against computer and player completed boxes, let them continue
      if (gameState.gameMode === 'vsComputer' && currentState.currentPlayer === 0) {
        return;
      }
    } else {
      // No boxes completed, switch turns
      if (gameState.gameMode === 'vsComputer' && !gameState.gameOver) {
        updateGameState({
          lines: newLines,
          boxes: currentState.boxes,
          scores: currentState.scores,
          currentPlayer: 1,
          isComputerThinking: true
        });
        setTimeout(() => {
          handleComputerTurn();
        }, COMPUTER_DELAY);
      } else {
        updateGameState({
          lines: newLines,
          boxes: currentState.boxes,
          scores: currentState.scores,
          currentPlayer: (currentState.currentPlayer + 1) % 2,
          isComputerThinking: false
        });
      }
    }
  };

  const handleComputerTurn = () => {
    if (gameState.gameOver) {
      updateGameState({ currentPlayer: 0, isComputerThinking: false });
      return;
    }

    setTimeout(() => {
      const didCompleteBox = makeComputerMove();
      if (didCompleteBox && !gameState.gameOver) {
        setTimeout(handleComputerTurn, COMPUTER_DELAY);
      }
    }, COMPUTER_DELAY);
  };

  const makeComputerMove = (): boolean => {
    const current = gameStateRef.current;
    const available = current.lines.filter(l => l.player === null);
    
    if (available.length === 0 || current.gameOver) {
      updateGameState({ currentPlayer: 0, isComputerThinking: false });
      return false;
    }

    // Find the best move that completes the most boxes
    const bestMove = available.reduce((best, line) => {
      const trialLines = [...current.lines];
      const idx = trialLines.findIndex(l => 
        l.row === line.row && l.col === line.col && l.isHorizontal === line.isHorizontal
      );
      trialLines[idx] = { ...line, player: 1 };

      const closed = checkForCompletedBoxes(trialLines);
      const newlyClosed = closed.filter(b => 
        current.boxes.find(bx => bx.row === b.row && bx.col === b.col)?.owner === null
      );

      return newlyClosed.length > best.gain ? { line, gain: newlyClosed.length } : best;
    }, { line: available[0], gain: -1 });

    // Commit the best move
    const newLines = [...current.lines];
    const commitIdx = newLines.findIndex(l => 
      l.row === bestMove.line.row && l.col === bestMove.line.col && l.isHorizontal === bestMove.line.isHorizontal
    );
    newLines[commitIdx] = { ...bestMove.line, player: 1 };

    const closedNow = checkForCompletedBoxes(newLines);
    const newlyClosed = closedNow.filter(b => 
      current.boxes.find(bx => bx.row === b.row && bx.col === b.col)?.owner === null
    );

    if (newlyClosed.length === 0) {
      updateGameState({ 
        lines: newLines, 
        currentPlayer: 0, 
        isComputerThinking: false 
      });
      return false;
    }

    const newBoxes = [...current.boxes];
    const newScores = [...current.scores];
    newlyClosed.forEach(b => {
      const i = newBoxes.findIndex(bx => bx.row === b.row && bx.col === b.col);
      newBoxes[i] = { ...b, owner: 1 };
      newScores[1]++;
    });

    const totalBoxes = GRID_SIZE * GRID_SIZE;
    const filledBoxes = newScores[0] + newScores[1];
    const isGameOver = filledBoxes === totalBoxes;

    updateGameState({
      lines: newLines,
      boxes: newBoxes,
      scores: newScores,
      currentPlayer: 1, // Keep computer's turn if it completed boxes
      isComputerThinking: !isGameOver,
      gameOver: isGameOver,
      showGameOverModal: isGameOver
    });

    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000B58] to-[#006A67] flex items-center justify-center">
      <div className="w-full max-w-[1024px] h-auto rounded-2xl p-4 flex flex-col md:flex-row">
        {/* Left Panel - Controls (Desktop only) */}
        <div className="w-full md:flex-1 flex flex-col gap-3 hidden md:flex order-1">
          <h1 className="text-[30px] font-bold text-[#eae4af] leading-none">Dots and Boxes</h1>
          
          {/* Players Section */}
          <div className="bg-[#001B4D]/30 rounded-xl p-3 border border-[#375b73]">
            <h2 className="text-[#eae4af] mb-2 uppercase text-sm font-semibold">Players</h2>
            <div className="space-y-2">
              <div className={`${gameState.currentPlayer === 0 ? 'bg-[#2b7fff]' : 'bg-[#184770]'} text-[#eae4af] p-2 rounded-lg flex items-center transition-colors border border-[#375b73]`}>
                <div style={{ width: '18px', height: '18px', border: '2px solid currentColor', borderRadius: '50%', backgroundColor: gameState.currentPlayer === 0 ? '#7fb7ff' : '#607c9b' }} />
                <span className="ml-2 font-bold">Player 1: {gameState.scores[0]}</span>
              </div>
              <div className={`${gameState.currentPlayer === 1 ? 'bg-[#fa2c37]' : 'bg-[#184770]'} text-[#eae4af] p-2 rounded-lg flex items-center transition-colors border border-[#375b73]`}>
                {gameState.gameMode === 'pvp' ? (
                  <div style={{ width: '18px', height: '18px', border: '2px solid currentColor', borderRadius: '4px', backgroundColor: gameState.currentPlayer === 1 ? '#ff7b82' : '#607c9b' }} />
                ) : (
                  <Bot size={18} />
                )}
                <span className="ml-2 font-bold">{gameState.gameMode === 'pvp' ? 'Player 2' : 'Computer'}: {gameState.scores[1]}</span>
              </div>
            </div>
          </div>

          {/* Game Controls */}
          <div className="bg-[#001B4D]/30 rounded-xl p-3 border border-[#375b73]">
            <h2 className="text-[#eae4af] mb-2 uppercase text-sm font-semibold">Game Controls</h2>
            <div className="space-y-2">
              <div className="rounded-lg p-1 flex border border-[#375b73]">
                <button
                  onClick={() => handleGameModeChange('pvp')}
                  className={`flex-1 p-2 rounded-md transition-colors ${
                    gameState.gameMode === 'pvp'
                      ? 'bg-[#eae4af] text-[#006666]'
                      : 'text-[#eae4af]'
                  }`}
                >
                  <div className={`flex items-center justify-center gap-1 transition-transform ${
                    gameState.gameMode !== 'pvp' ? 'hover:scale-110' : ''
                  }`}>
                    <User size={20} strokeWidth={1.5} />
                    <User size={20} strokeWidth={1.5} />
                  </div>
                </button>
                <button
                  onClick={() => handleGameModeChange('vsComputer')}
                  className={`flex-1 p-2 rounded-md transition-colors ${
                    gameState.gameMode === 'vsComputer'
                      ? 'bg-[#eae4af] text-[#006666]'
                      : 'text-[#eae4af]'
                  }`}
                >
                  <div className={`flex items-center justify-center gap-1 transition-transform ${
                    gameState.gameMode !== 'vsComputer' ? 'hover:scale-110' : ''
                  }`}>
                    <User size={20} strokeWidth={1.5} />
                    <Bot size={20} strokeWidth={1.5} />
                  </div>
                </button>
              </div>
              <button
                onClick={resetGame}
                className="w-full p-2 bg-[#eae4af] text-[#006666] rounded-lg transition-transform duration-200 hover:scale-105 border border-[#375b73] font-bold"
              >
                ↺ Reset Game
              </button>
              <button
                onClick={() => setGameState(prev => ({ ...prev, showHowToPlay: true }))}
                className="w-full p-2 bg-[#006666] text-[#eae4af] rounded-lg transition-transform duration-200 hover:scale-105 border border-[#375b73] flex items-center justify-center gap-2 font-bold"
              >
                <HelpCircle size={20} />
                How to Play
              </button>
            </div>
          </div>
        </div>

        {/* Center - Game Board */}
        <div className="flex-none flex items-center justify-center order-2 px-14">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${gameState.gameMode}-${gameState.gameKey}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: ANIMATION_DURATION }}
              className="w-[380px] h-[380px] flex-shrink-0 relative"
            >
              <div className="absolute inset-0 p-6">
                {/* Dots */}
                {Array.from({ length: (GRID_SIZE + 1) ** 2 }).map((_, index) => {
                  const row = Math.floor(index / (GRID_SIZE + 1));
                  const col = index % (GRID_SIZE + 1);
                  return (
                    <div
                      key={`dot-${row}-${col}`}
                      className="absolute w-3 h-3 rounded-full"
                      style={{
                        left: `${(col * 100) / GRID_SIZE}%`,
                        top: `${(row * 100) / GRID_SIZE}%`,
                        transform: 'translate(-50%, -50%)',
                        zIndex: 2,
                        backgroundColor: '#eae4af'
                      }}
                    />
                  );
                })}

                {/* Horizontal Lines */}
                {Array.from({ length: (GRID_SIZE + 1) * GRID_SIZE }).map((_, index) => {
                  const row = Math.floor(index / GRID_SIZE);
                  const col = index % GRID_SIZE;
                  const lineIndex = row * GRID_SIZE + col;
                  const line = gameState.lines[lineIndex];
                  
                  if (!line) return null;

                  return (
                    <motion.div
                      key={`h-line-${row}-${col}`}
                      className={`absolute cursor-pointer ${
                        line.player !== null ? 'opacity-100' : 'opacity-50 hover:opacity-70'
                      }`}
                      style={{
                        left: `${(col * 100) / GRID_SIZE}%`,
                        top: `${(row * 100) / GRID_SIZE}%`,
                        width: `calc(${100 / GRID_SIZE}% - 29px)`,
                        height: '10px',
                        backgroundColor: 'transparent',
                        transform: 'translate(14.5px, -50%)',
                        zIndex: 1
                      }}
                      onClick={() => handleLineClick(line)}
                    >
                      <div
                        className="absolute left-0 right-0 top-1/2 transform -translate-y-1/2 rounded-full transition-transform duration-2000 ease-out hover:scale-[1.03]"
                        style={{
                          height: '8px',
                          backgroundColor: line.player !== null ? PLAYER_COLORS[line.player] : '#eae4af'
                        }}
                      />
                    </motion.div>
                  );
                })}

                {/* Vertical Lines */}
                {Array.from({ length: GRID_SIZE * (GRID_SIZE + 1) }).map((_, index) => {
                  const row = Math.floor(index / (GRID_SIZE + 1));
                  const col = index % (GRID_SIZE + 1);
                  const lineIndex = (GRID_SIZE + 1) * GRID_SIZE + row * (GRID_SIZE + 1) + col;
                  const line = gameState.lines[lineIndex];

                  if (!line) return null;

                  return (
                    <motion.div
                      key={`v-line-${row}-${col}`}
                      className={`absolute cursor-pointer ${
                        line.player !== null ? 'opacity-100' : 'opacity-50 hover:opacity-70'
                      }`}
                      style={{
                        left: `${(col * 100) / GRID_SIZE}%`,
                        top: `${(row * 100) / GRID_SIZE}%`,
                        width: '10px',
                        height: `calc(${100 / GRID_SIZE}% - 29px)`,
                        backgroundColor: 'transparent',
                        transform: 'translate(-50%, 14.5px)',
                        zIndex: 1
                      }}
                      onClick={() => handleLineClick(line)}
                    >
                      <div
                        className="absolute top-0 bottom-0 left-1/2 transform -translate-x-1/2 rounded-full transition-transform duration-300 ease-out hover:scale-[1.03]"
                        style={{
                          width: '8px',
                          backgroundColor: line.player !== null ? PLAYER_COLORS[line.player] : '#eae4af'
                      }}
                      />
                    </motion.div>
                  );
                })}

                {/* Boxes */}
                {gameState.boxes.map((box) => (
                  <div
                    key={`box-${box.row}-${box.col}`}
                    className="absolute"
                    style={{
                      left: `${((box.col + 0.5) * 100) / GRID_SIZE}%`,
                      top: `${((box.row + 0.5) * 100) / GRID_SIZE}%`,
                      width: `calc(${100 / GRID_SIZE}% - 28px)`,
                      height: `calc(${100 / GRID_SIZE}% - 28px)`,
                      transform: 'translate(-50%, -50%)',
                      borderRadius: '4px'
                    }}
                  >
                    <motion.div
                      className="w-full h-full"
                      initial={{ scale: 0 }}
                      animate={box.owner !== null ? { scale: 1 } : { scale: 0 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                        mass: 0.8
                      }}
                      style={{
                        backgroundColor: box.owner !== null ? 'white' : 'transparent',
                        borderRadius: '4px'
                      }}
                    >
                      {box.owner !== null && (
                        <motion.div 
                          className="w-full h-full flex items-center justify-center relative"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 17,
                            mass: 0.8,
                            delay: 0.1
                          }}
                          style={{
                            backgroundColor: box.owner === 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '4px'
                          }}
                        >
                          {box.owner === 0 ? (
                            <div
                              style={{
                                width: '30px',
                                height: '30px',
                                border: '2px solid #3B82F6',
                                borderRadius: '50%'
                              }}
                            />
                          ) : (
                            gameState.gameMode === 'pvp' ? (
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  border: '2px solid #EF4444',
                                  borderRadius: '4px'
                                }}
                              />
                            ) : (
                              <Bot size={32} className="text-[#EF4444]" />
                            )
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Title for mobile */}
        <h1 className="text-[36px] font-bold text-[#eae4af] text-center order-3 md:hidden mt-4">Dots and Boxes</h1>

        {/* Right Panel - Game Status (Desktop only) */}
        <div className="w-full md:flex-1 hidden md:block order-4">
          <div className="bg-[#001B4D]/30 rounded-xl p-3 border border-[#375b73]">
            <h2 className="text-[#eae4af] mb-2 uppercase text-sm font-semibold">Game Status</h2>
            <div className="space-y-2 text-[#eae4af]">
              <p className="text-[14px]">Current turn: {gameState.currentPlayer === 0 ? 'Player 1' : gameState.gameMode === 'pvp' ? 'Player 2' : 'Computer'}</p>
              <p className="text-[14px]">Total boxes: {GRID_SIZE * GRID_SIZE}</p>
              <p className="text-[14px]">Boxes claimed: {gameState.scores[0] + gameState.scores[1]}</p>
              <p className="text-[14px]">Remaining: {GRID_SIZE * GRID_SIZE - (gameState.scores[0] + gameState.scores[1])}</p>
              <div className="border-t border-[#eae4af]/50 my-3"></div>
              <p className="text-[12px]">
                {gameState.gameMode === 'vsComputer' 
                  ? "Computer mode: Play against AI that makes strategic moves."
                  : "Two-player mode: Take turns with a friend to complete boxes."}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Controls */}
        <div className="w-full flex flex-col gap-3 order-4 md:hidden mt-4">
          {/* Players Section */}
          <div className="bg-[#001B4D]/30 rounded-xl p-3 border border-[#375b73]">
            <h2 className="text-[#eae4af] mb-2 uppercase text-sm font-semibold text-center">Players</h2>
            <div className="space-y-2">
              <div className={`${gameState.currentPlayer === 0 ? 'bg-[#2b7fff]' : 'bg-[#184770]'} text-[#eae4af] p-2 rounded-lg flex items-center transition-colors border border-[#375b73]`}>
                <div style={{ width: '18px', height: '18px', border: '2px solid currentColor', borderRadius: '50%', backgroundColor: gameState.currentPlayer === 0 ? '#7fb7ff' : '#607c9b' }} />
                <span className="ml-2 font-bold">Player 1: {gameState.scores[0]}</span>
              </div>
              <div className={`${gameState.currentPlayer === 1 ? 'bg-[#fa2c37]' : 'bg-[#184770]'} text-[#eae4af] p-2 rounded-lg flex items-center transition-colors border border-[#375b73]`}>
                {gameState.gameMode === 'pvp' ? (
                  <div style={{ width: '18px', height: '18px', border: '2px solid currentColor', borderRadius: '4px', backgroundColor: gameState.currentPlayer === 1 ? '#ff7b82' : '#607c9b' }} />
                ) : (
                  <Bot size={18} />
                )}
                <span className="ml-2 font-bold">{gameState.gameMode === 'pvp' ? 'Player 2' : 'Computer'}: {gameState.scores[1]}</span>
              </div>
            </div>
          </div>

          {/* Game Controls */}
          <div className="bg-[#001B4D]/30 rounded-xl p-3 border border-[#375b73]">
            <h2 className="text-[#eae4af] mb-2 uppercase text-sm font-semibold text-center">Game Controls</h2>
            <div className="space-y-2">
              <div className="rounded-lg p-1 flex border border-[#375b73]">
                <button
                  onClick={() => handleGameModeChange('pvp')}
                  className={`flex-1 p-2 rounded-md transition-colors ${
                    gameState.gameMode === 'pvp'
                      ? 'bg-[#eae4af] text-[#006666]'
                      : 'text-[#eae4af]'
                  }`}
                >
                  <div className={`flex items-center justify-center gap-1 transition-transform ${
                    gameState.gameMode !== 'pvp' ? 'hover:scale-110' : ''
                  }`}>
                    <User size={20} strokeWidth={1.5} />
                    <User size={20} strokeWidth={1.5} />
                  </div>
                </button>
                <button
                  onClick={() => handleGameModeChange('vsComputer')}
                  className={`flex-1 p-2 rounded-md transition-colors ${
                    gameState.gameMode === 'vsComputer'
                      ? 'bg-[#eae4af] text-[#006666]'
                      : 'text-[#eae4af]'
                  }`}
                >
                  <div className={`flex items-center justify-center gap-1 transition-transform ${
                    gameState.gameMode !== 'vsComputer' ? 'hover:scale-110' : ''
                  }`}>
                    <User size={20} strokeWidth={1.5} />
                    <Bot size={20} strokeWidth={1.5} />
                  </div>
                </button>
              </div>
              <button
                onClick={resetGame}
                className="w-full p-2 bg-[#eae4af] text-[#006666] rounded-lg transition-transform duration-200 hover:scale-105 border border-[#375b73] font-bold"
              >
                ↺ Reset Game
              </button>
              <button
                onClick={() => setGameState(prev => ({ ...prev, showHowToPlay: true }))}
                className="w-full p-2 bg-[#006666] text-[#eae4af] rounded-lg transition-transform duration-200 hover:scale-105 border border-[#375b73] flex items-center justify-center gap-2 font-bold"
              >
                <HelpCircle size={20} />
                How to Play
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How to Play Modal */}
      <AnimatePresence>
      {gameState.showHowToPlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="fixed inset-0 backdrop-blur-md bg-gradient-to-br from-[#000B58]/80 to-[#006A67]/80 flex items-center justify-center p-4 z-50"
        >
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="bg-gradient-to-br from-[#003161] to-[#006A67] p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border-2 border-[#FFF4B7]"
          >
            <motion.h2 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="text-3xl font-bold text-[#eae4af] mb-8 text-center"
            >
              How to Play
            </motion.h2>
            <div className="space-y-6 mb-8">
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.15 }}
                className="flex items-start gap-4"
              >
                <span className="bg-[#eae4af] text-[#003366] w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0">1</span>
                <p className="text-base text-[#eae4af]">Players take turns connecting adjacent dots with horizontal or vertical lines</p>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.2 }}
                className="flex items-start gap-4"
              >
                <span className="bg-[#eae4af] text-[#003366] w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0">2</span>
                <p className="text-base text-[#eae4af]">When you complete a square (the fourth side), you claim that box and get a point</p>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.25 }}
                className="flex items-start gap-4"
              >
                <span className="bg-[#eae4af] text-[#003366] w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0">3</span>
                <p className="text-base text-[#eae4af]">If you complete a box, you get another turn</p>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.3 }}
                className="flex items-start gap-4"
              >
                <span className="bg-[#eae4af] text-[#003366] w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0">4</span>
                <p className="text-base text-[#eae4af]">The game ends when all boxes are claimed. The player with the most boxes wins!</p>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.35 }}
                className="flex items-start gap-4"
              >
                <span className="bg-[#eae4af] text-[#003366] w-7 h-7 rounded-full flex items-center justify-center font-bold flex-shrink-0">5</span>
                <p className="text-base text-[#eae4af]">Against computer, the AI will automatically make moves when it's its turn</p>
              </motion.div>
            </div>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.4 }}
              onClick={() => setGameState(prev => ({ ...prev, showHowToPlay: false }))}
              className="w-full py-3 bg-[#eae4af] text-[#006666] rounded-xl font-semibold text-lg transition-all duration-200 hover:scale-105"
              style={{ transitionDelay: '500ms' }}
            >
              Start Game
            </motion.button>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameState.showGameOverModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="fixed inset-0 backdrop-blur-md bg-gradient-to-br from-[#000B58]/80 to-[#006A67]/80 flex items-center justify-center p-4 z-50"
          >
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="bg-gradient-to-br from-[#003161] to-[#006A67] p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 border-2 border-[#FFF4B7]"
            >
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="flex flex-col items-center gap-4"
              >
                <motion.div 
                  className="text-[#eae4af] text-4xl font-bold flex items-center gap-3"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    filter: [
                      'brightness(1)',
                      'brightness(1.2)',
                      'brightness(1)'
                    ]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  {gameState.scores[0] > gameState.scores[1] ? (
                    <>
                      <Crown size={40} className="text-[#eae4af]" />
                      Player 1 Wins!
                    </>
                  ) : gameState.scores[1] > gameState.scores[0] ? (
                    <>
                      <Crown size={40} className="text-[#eae4af]" />
                      {gameState.gameMode === 'pvp' ? 'Player 2' : 'Computer'} Wins!
                    </>
                  ) : (
                    "It's a Tie!"
                  )}
                </motion.div>
                <p className="text-[#eae4af] text-xl mt-2">
                  {gameState.scores[0] > gameState.scores[1] ? (
                    `Player 1 scored ${gameState.scores[0]} points!`
                  ) : gameState.scores[1] > gameState.scores[0] ? (
                    `${gameState.gameMode === 'pvp' ? 'Player 2' : 'Computer'} scored ${gameState.scores[1]} points!`
                  ) : (
                    `Both players scored ${gameState.scores[0]} points!`
                  )}
                </p>
                <div className="flex gap-4 mt-6 w-full">
                  <button
                    onClick={resetGame}
                    className="flex-1 py-3 bg-[#eae4af] hover:bg-[#f7f2c7] text-[#003366] rounded-xl font-semibold text-lg transition-colors"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={() => setGameState(prev => ({ ...prev, showGameOverModal: false }))}
                    className="flex-1 py-3 bg-[#006666] hover:bg-[#007777] text-[#eae4af] rounded-xl font-semibold text-lg transition-colors border border-[#eae4af]"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom right corner text */}
      <div className="fixed bottom-2 right-2 text-[#eae4af]/60 text-[12px]">
        Dots and Boxes
      </div>
    </div>
  );
};

export default DotsAndBoxes; 