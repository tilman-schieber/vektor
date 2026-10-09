// In-game help pages. Text uses only characters the pixel font has.

export interface HelpPage {
  title: string;
  /** Paragraphs, word-wrapped when drawn; '' adds a blank line. */
  text: string[];
}

export const HELP_PAGES: HelpPage[] = [
  {
    title: 'VEKTOR',
    text: [
      'FLY NORTH OVER SEA, JUNGLE AND THE ENEMY BASE, ACROSS THE DESERT, INTO THE ARCTIC, THROUGH A CITY AT NIGHT, INTO A VOLCANO AND UP INTO ORBIT. SHOOT DOWN EVERYTHING, DODGE EVERYTHING ELSE.',
      '',
      'ONLY THE SMALL CORE OF YOUR SHIP CAN BE HIT.',
      '',
      'YOU HAVE 3 SHIPS AND WIN MORE AT 200000 AND 500000 POINTS. BEAT ALL SIX STAGES AND IT ALL STARTS AGAIN, FASTER.',
    ],
  },
  {
    title: 'WEAPONS',
    text: [
      'RED VULCAN: A WIDE SPREAD. BLUE LASER: A STRONG BEAM THAT GOES THROUGH. VIOLET PLASMA: LIGHTNING THAT FINDS ITS OWN TARGETS AND JUMPS ON.',
      '',
      'YOU START WITH THE VULCAN. A NEW WEAPON JOINS YOUR ARSENAL; EVERY WEAPON PICKUP POWERS UP, UP TO 5.',
      '',
      'C SWITCHES WEAPON. GREEN MISSILES HOME IN, YELLOW IS A BOMB.',
    ],
  },
  {
    title: 'BOMBS AND MEDALS',
    text: [
      'A BOMB WIPES OUT ENEMY BULLETS, HURTS EVERYTHING ON SCREEN, AND KEEPS YOU SAFE WHILE IT BURNS.',
      '',
      'LOSE A SHIP AND YOU LOSE HALF YOUR WEAPON LEVELS AND HALF YOUR MISSILES, AT LEAST ONE OF EACH. YOU START AGAIN WITH 3 BOMBS.',
      '',
      'BUNKERS HIDE GOLD MEDALS. EACH ONE YOU PICK UP IS WORTH 500 MORE THAN THE LAST, UP TO 10000 - LET ONE SLIP AWAY AND IT IS BACK TO 500.',
    ],
  },
  {
    title: 'EASY MODE',
    text: [
      'PICK EASY UNDER MODE ON THE TITLE SCREEN.',
      '',
      'YOUR SHIP CARRIES A SHIELD. IT TAKES THE FIRST HIT AND COMES BACK 20 SECONDS LATER - THE BAR ABOVE YOUR WEAPONS FILLS UP AS IT CHARGES. EVERY NEW SHIP STARTS WITH IT UP.',
      '',
      'EASY HAS ITS OWN HIGH SCORES. LEFT AND RIGHT ON THE SCORE SCREEN SWITCH BETWEEN THEM.',
    ],
  },
  {
    title: '2 PLAYERS',
    text: [
      'SET PLAYERS TO 2 ON THE TITLE SCREEN AND FLY TOGETHER: RED AND BLUE SHARE THE SCORE, EACH WITH THEIR OWN SHIPS, WEAPONS AND BOMBS. IT IS OVER WHEN BOTH ARE OUT.',
      '',
      '1P   W A S D, SPACE FIRE, LEFT SHIFT BOMB, E SWITCH',
      '2P   ARROWS, . FIRE, - BOMB, COMMA SWITCH',
      '',
      'ONE GAMEPAD IS 2P, THE KEYBOARD 1P. TWO GAMEPADS: ONE EACH. ENEMIES ARE TOUGHER FOR TWO.',
    ],
  },
  {
    title: 'CONTROLS',
    text: [
      'ARROWS OR WASD   MOVE',
      'SPACE Z J        FIRE (HOLD)',
      'X SHIFT K        BOMB',
      'C                SWITCH WEAPON',
      'ENTER ESC        PAUSE',
      'BACKSPACE        QUIT (PAUSED)',
      'M                MUSIC',
      '',
      'GAMEPAD: STICK OR D-PAD MOVE, A FIRE, B BOMB, LB RB SWITCH, START PAUSE, SELECT QUIT (PAUSED).',
      '',
      'ON A PHONE, DRAG ANYWHERE ON THE SCREEN TO FLY. YOU FIRE WHILE YOUR FINGER IS DOWN.',
    ],
  },
];

export function wrapText(paragraphs: string[], width: number) {
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of para.split(' ')) {
      if (line && line.length + 1 + word.length > width) {
        lines.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    lines.push(line);
  }
  return lines;
}
