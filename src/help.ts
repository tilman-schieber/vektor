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
      'FLY NORTH OVER SEA, JUNGLE AND THE ENEMY BASE, ACROSS THE DESERT, INTO THE ARCTIC, THROUGH A CITY AT NIGHT AND INTO A VOLCANO. SHOOT DOWN EVERYTHING, DODGE EVERYTHING ELSE.',
      '',
      'ONLY THE SMALL CORE OF YOUR SHIP CAN BE HIT.',
      '',
      'YOU HAVE 3 SHIPS AND WIN MORE AT 200000 AND 500000 POINTS. BEAT ALL FIVE STAGES AND IT ALL STARTS AGAIN, FASTER.',
    ],
  },
  {
    title: 'WEAPONS',
    text: [
      'CARRIERS DROP POWER-UPS WHEN SHOT DOWN.',
      '',
      'THE WEAPON ORB CHANGES COLOUR: RED V IS THE VULCAN, A WIDE SPREAD. BLUE L IS THE LASER, NARROW AND STRONG, IT GOES THROUGH.',
      '',
      'CATCH YOUR OWN COLOUR TO POWER UP, UP TO 5. THE OTHER COLOUR SWITCHES WEAPON.',
      '',
      'GREEN M ADDS HOMING MISSILES. YELLOW B IS A BOMB.',
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
    title: 'CONTROLS',
    text: [
      'ARROWS OR WASD   MOVE',
      'SPACE Z J        FIRE (HOLD)',
      'X SHIFT K        BOMB',
      'ENTER ESC        PAUSE',
      'BACKSPACE        QUIT (PAUSED)',
      'M                MUSIC',
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
