export type RequestBody = {
  roomCode: string;
  playerId: string;
  action: 'join' | 'play' | 'draw' | 'start';
  payload?: any;
};
