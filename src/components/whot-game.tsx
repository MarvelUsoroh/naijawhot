import { useState } from 'react';
import { WhotCard, Card, CardShape, CardNumber } from './card';
import { Sparkles, RotateCcw } from 'lucide-react';

// Game constants
const SHAPES: CardShape[] = ['circle', 'square', 'triangle', 'star', 'cross'];
const NUMBERS: CardNumber[] = [1, 2, 3, 4, 5, 7, 8, 10, 11, 12, 13, 14, 20];

// Special cards
const PICK_TWO = 2;
const PICK_THREE = 5;
const HOLD_ON = 1;
const GENERAL_MARKET = 14;
const WHOT = 20;

function createDeck(): Card[] {
  const deck: Card[] = [];
  let id = 0;

  // Standard cards - each number appears on each shape
  SHAPES.forEach(shape => {
    NUMBERS.forEach(number => {
      const count = number === 20 ? 1 : 2; // Only 1 whot card per shape
      for (let i = 0; i < count; i++) {
        deck.push({ id: `${id++}`, shape, number });
      }
    });
  });

  return deck;
}

function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function WhotGame() {
  const [deck, setDeck] = useState<Card[]>([]);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [computerHand, setComputerHand] = useState<Card[]>([]);
  const [playedCards, setPlayedCards] = useState<Card[]>([]);
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState('Click "Start Game" to begin!');
  const [pendingAction, setPendingAction] = useState<{
    type: 'pick' | 'hold';
    count?: number;
  } | null>(null);
  const [selectedShape, setSelectedShape] = useState<CardShape | null>(null);
  const [winner, setWinner] = useState<'player' | 'computer' | null>(null);

  const startGame = () => {
    const newDeck = shuffleDeck(createDeck());
    const playerCards = newDeck.slice(0, 6);
    const computerCards = newDeck.slice(6, 12);
    const firstCard = newDeck[12];
    const remainingDeck = newDeck.slice(13);

    setPlayerHand(playerCards);
    setComputerHand(computerCards);
    setPlayedCards([firstCard]);
    setDeck(remainingDeck);
    setIsPlayerTurn(true);
    setGameStarted(true);
    setMessage('Your turn! Play a matching card.');
    setPendingAction(null);
    setSelectedShape(null);
    setWinner(null);
  };

  const currentCard = playedCards[playedCards.length - 1];

  const canPlayCard = (card: Card): boolean => {
    if (!currentCard) return false;
    if (card.number === WHOT) return true;
    if (selectedShape) {
      return card.shape === selectedShape || card.number === currentCard.number;
    }
    return card.shape === currentCard.shape || card.number === currentCard.number;
  };

  const drawCards = (count: number, isPlayer: boolean) => {
    if (deck.length < count) {
      // Reshuffle played cards except the top one
      const cardsToShuffle = playedCards.slice(0, -1);
      const newDeck = shuffleDeck([...deck, ...cardsToShuffle]);
      setDeck(newDeck);
      setPlayedCards([currentCard]);
      
      const drawnCards = newDeck.slice(0, count);
      const remainingDeck = newDeck.slice(count);
      
      if (isPlayer) {
        setPlayerHand([...playerHand, ...drawnCards]);
      } else {
        setComputerHand([...computerHand, ...drawnCards]);
      }
      setDeck(remainingDeck);
    } else {
      const drawnCards = deck.slice(0, count);
      const remainingDeck = deck.slice(count);
      
      if (isPlayer) {
        setPlayerHand([...playerHand, ...drawnCards]);
      } else {
        setComputerHand([...computerHand, ...drawnCards]);
      }
      setDeck(remainingDeck);
    }
  };

  const handleCardPlay = (card: Card) => {
    if (!isPlayerTurn || !canPlayCard(card)) return;

    // Remove card from player hand
    const newPlayerHand = playerHand.filter(c => c.id !== card.id);
    setPlayerHand(newPlayerHand);
    setPlayedCards([...playedCards, card]);
    setSelectedShape(null);

    // Check if player won
    if (newPlayerHand.length === 0) {
      setWinner('player');
      setMessage('🎉 You won! Congratulations!');
      setGameStarted(false);
      return;
    }

    // Handle special cards
    if (card.number === WHOT) {
      setMessage('Choose a shape for the next player!');
      return; // Wait for shape selection
    } else if (card.number === PICK_TWO) {
      setPendingAction({ type: 'pick', count: 2 });
      setMessage('Computer must pick 2 cards!');
      setTimeout(() => {
        drawCards(2, false);
        setPendingAction(null);
        setMessage('Your turn!');
      }, 1500);
      return;
    } else if (card.number === PICK_THREE) {
      setPendingAction({ type: 'pick', count: 3 });
      setMessage('Computer must pick 3 cards!');
      setTimeout(() => {
        drawCards(3, false);
        setPendingAction(null);
        setMessage('Your turn!');
      }, 1500);
      return;
    } else if (card.number === HOLD_ON) {
      setMessage('Computer is held! Your turn again!');
      return;
    } else if (card.number === GENERAL_MARKET) {
      setMessage('General Market! Everyone picks a card!');
      setTimeout(() => {
        drawCards(1, true);
        drawCards(1, false);
        setIsPlayerTurn(false);
        setMessage("Computer's turn...");
        setTimeout(computerPlay, 1000);
      }, 1500);
      return;
    }

    // Normal card - switch turn
    setIsPlayerTurn(false);
    setMessage("Computer's turn...");
    setTimeout(computerPlay, 1000);
  };

  const computerPlay = () => {
    const playableCards = computerHand.filter(canPlayCard);

    if (playableCards.length > 0) {
      // Play a random playable card
      const cardToPlay = playableCards[Math.floor(Math.random() * playableCards.length)];
      const newComputerHand = computerHand.filter(c => c.id !== cardToPlay.id);
      setComputerHand(newComputerHand);
      setPlayedCards(prev => [...prev, cardToPlay]);

      // Check if computer won
      if (newComputerHand.length === 0) {
        setWinner('computer');
        setMessage('Computer won! Try again.');
        setGameStarted(false);
        return;
      }

      // Handle special cards
      if (cardToPlay.number === WHOT) {
        // Computer chooses a random shape
        const randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        setSelectedShape(randomShape);
        setMessage(`Computer chose ${randomShape}. Your turn!`);
        setIsPlayerTurn(true);
      } else if (cardToPlay.number === PICK_TWO) {
        setPendingAction({ type: 'pick', count: 2 });
        setMessage('You must pick 2 cards!');
        setTimeout(() => {
          drawCards(2, true);
          setPendingAction(null);
          setIsPlayerTurn(true);
          setMessage('Your turn!');
        }, 1500);
      } else if (cardToPlay.number === PICK_THREE) {
        setPendingAction({ type: 'pick', count: 3 });
        setMessage('You must pick 3 cards!');
        setTimeout(() => {
          drawCards(3, true);
          setPendingAction(null);
          setIsPlayerTurn(true);
          setMessage('Your turn!');
        }, 1500);
      } else if (cardToPlay.number === HOLD_ON) {
        setMessage('You are held! Computer plays again...');
        setTimeout(computerPlay, 1000);
      } else if (cardToPlay.number === GENERAL_MARKET) {
        setMessage('General Market! Everyone picks a card!');
        setTimeout(() => {
          drawCards(1, true);
          drawCards(1, false);
          setIsPlayerTurn(true);
          setMessage('Your turn!');
        }, 1500);
      } else {
        setIsPlayerTurn(true);
        setMessage('Your turn!');
      }
    } else {
      // Computer picks a card
      drawCards(1, false);
      setMessage('Computer picked a card. Your turn!');
      setIsPlayerTurn(true);
    }
  };

  const handleMarket = () => {
    if (!isPlayerTurn) return;
    
    drawCards(1, true);
    
    // Check if the drawn card can be played
    const canPlayAny = playerHand.some(canPlayCard);
    
    if (!canPlayAny) {
      setIsPlayerTurn(false);
      setMessage("Computer's turn...");
      setTimeout(computerPlay, 1000);
    } else {
      setMessage('You picked a card. Play or go to market again!');
    }
  };

  const handleShapeSelection = (shape: CardShape) => {
    setSelectedShape(shape);
    setMessage(`You chose ${shape}. Computer's turn...`);
    setIsPlayerTurn(false);
    setTimeout(computerPlay, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 text-white">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-5xl mb-2 text-yellow-300 drop-shadow-lg">🇳🇬 Naija Whot! 🇳🇬</h1>
        <p className="text-xl opacity-90">{message}</p>
      </div>

      {/* Computer Hand */}
      <div className="flex gap-2 flex-wrap justify-center min-h-32 items-center">
        {computerHand.map((card, index) => (
          <WhotCard 
            key={card.id} 
            card={card} 
            faceDown 
            className="transform -rotate-2 animate-in fade-in slide-in-from-top duration-300"
            style={{ animationDelay: `${index * 50}ms` }}
          />
        ))}
        {computerHand.length === 0 && gameStarted && (
          <div className="text-xl opacity-70">Computer has no cards</div>
        )}
      </div>

      {/* Game Board */}
      <div className="flex items-center gap-8">
        {/* Deck */}
        <div className="text-center">
          <div className="relative">
            <WhotCard 
              card={{ id: 'deck', shape: 'circle', number: 1 }} 
              faceDown 
              onClick={handleMarket}
              disabled={!gameStarted || !isPlayerTurn || pendingAction !== null}
            />
            {deck.length > 0 && (
              <div className="absolute -top-2 -right-2 bg-yellow-400 text-green-900 rounded-full w-8 h-8 flex items-center justify-center shadow-lg animate-pulse">
                {deck.length}
              </div>
            )}
          </div>
          <div className="mt-2 text-sm">Market</div>
        </div>

        {/* Current Card */}
        <div className="text-center">
          {currentCard ? (
            <>
              <WhotCard card={currentCard} className="transform scale-110 animate-in zoom-in duration-300" />
              {selectedShape && (
                <div className="mt-2 text-sm bg-yellow-400 text-green-900 px-3 py-1 rounded-full inline-block animate-in fade-in slide-in-from-bottom duration-300">
                  Shape: {selectedShape}
                </div>
              )}
            </>
          ) : (
            <div className="w-20 h-28 rounded-lg border-2 border-dashed border-white/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 opacity-30" />
            </div>
          )}
        </div>
      </div>

      {/* Shape Selection (when player plays Whot card) */}
      {gameStarted && isPlayerTurn && playedCards[playedCards.length - 1]?.number === WHOT && 
       playedCards[playedCards.length - 1]?.id.startsWith(playerHand.length.toString()) && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 animate-in fade-in zoom-in duration-300">
          <p className="text-center mb-4">Choose a shape:</p>
          <div className="flex gap-4">
            {SHAPES.map(shape => (
              <button
                key={shape}
                onClick={() => handleShapeSelection(shape)}
                className="px-6 py-3 bg-yellow-400 text-green-900 rounded-lg hover:bg-yellow-300 hover:scale-105 transition-all capitalize shadow-lg"
              >
                {shape}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Player Hand */}
      <div>
        <div className="flex gap-2 flex-wrap justify-center mb-4 min-h-32 items-center">
          {playerHand.map((card, index) => (
            <WhotCard
              key={card.id}
              card={card}
              onClick={() => handleCardPlay(card)}
              disabled={!isPlayerTurn || !canPlayCard(card) || pendingAction !== null}
              className="animate-in fade-in slide-in-from-bottom duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            />
          ))}
          {playerHand.length === 0 && gameStarted && (
            <div className="text-xl opacity-70">You have no cards</div>
          )}
        </div>
        <div className="text-center text-sm opacity-75">
          Your cards: {playerHand.length}
        </div>
      </div>

      {/* Start/Restart Button */}
      <div className="text-center">
        {!gameStarted ? (
          <button
            onClick={startGame}
            className="px-8 py-4 bg-yellow-400 text-green-900 rounded-xl text-xl hover:bg-yellow-300 hover:scale-105 transition-all flex items-center gap-2 mx-auto shadow-xl"
          >
            {winner ? (
              <>
                <RotateCcw className="w-6 h-6" />
                Play Again
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                Start Game
              </>
            )}
          </button>
        ) : (
          <button
            onClick={startGame}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all hover:scale-105"
          >
            New Game
          </button>
        )}
      </div>
    </div>
  );
}